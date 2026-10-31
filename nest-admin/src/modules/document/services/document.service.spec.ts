import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { EntityManager, QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm'

import { DocumentScopeEnum, DocumentStatusEnum } from '../document.constant'
import { DocumentEntity } from '../document.entity'
import { CreateDocumentDto } from '../dto/create-document.dto'
import { R2StorageService } from '../r2-storage.service'
import { DocumentApprovalService } from './document-approval.service'
import { DocumentPermissionService } from './document-permission.service'
import { DocumentService } from './document.service'

describe('DocumentService', () => {
  let service: DocumentService
  let mockDocRepo: Partial<Repository<DocumentEntity>>
  let mockR2StorageService: Partial<R2StorageService>
  let permissionService: DocumentPermissionService
  let mockApprovalService: Partial<DocumentApprovalService>
  let mockManager: Partial<EntityManager>

  const normalUser: IAuthUser = {
    uid: 100,
    username: 'uploader',
    roles: ['user'],
  } as any

  const otherUser: IAuthUser = {
    uid: 200,
    username: 'other',
    roles: ['user'],
  } as any

  const adminUser: IAuthUser = {
    uid: 1,
    username: 'admin',
    roles: ['admin'],
  } as any

  beforeEach(() => {
    mockManager = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 999, ...entity })),
      create: jest.fn().mockImplementation((_, entity) => entity),
      delete: jest.fn().mockResolvedValue({ affected: 1 } as any),
    }

    mockDocRepo = {
      findOne: jest.fn(),
      manager: {
        transaction: jest.fn().mockImplementation((cb: (mgr: EntityManager) => any) => cb(mockManager as EntityManager)),
      } as any,
      createQueryBuilder: jest.fn(),
    }

    mockR2StorageService = {
      generatePresignedPutUrl: jest.fn().mockResolvedValue({
        uploadUrl: 'https://r2.example.com/put-signed',
        storageKey: 'knowledge/docs/20261031/100/sample.pdf',
        publicUrl: 'https://cdn.example.com/knowledge/docs/20261031/100/sample.pdf',
        expiresIn: 900,
      }),
      buildPublicUrl: jest.fn().mockReturnValue('https://cdn.example.com/real-url.pdf'),
      verifyUploadedObject: jest.fn().mockResolvedValue(undefined),
      generatePresignedGetUrl: jest.fn().mockResolvedValue('https://r2.example.com/get-signed'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    }

    permissionService = new DocumentPermissionService()
    mockApprovalService = {
      findHistoryByCode: jest.fn().mockResolvedValue([]),
      deleteByDocCode: jest.fn().mockResolvedValue(undefined),
      appendRecord: jest.fn().mockResolvedValue({ id: 1 } as any),
    }

    service = new DocumentService(
      mockDocRepo as Repository<DocumentEntity>,
      mockR2StorageService as R2StorageService,
      permissionService,
      mockApprovalService as DocumentApprovalService,
    )
  })

  describe('create (文档直传后落库)', () => {
    const createDto: CreateDocumentDto = {
      title: '企业规章制度',
      category: '安全合规',
      fileName: 'rule<test>.pdf',
      fileSize: 10240,
      fileType: '.pdf',
      storageKey: 'knowledge/docs/20261031/100/valid-key.pdf',
      publicUrl: 'https://malicious.url/fake.pdf',
      scope: DocumentScopeEnum.PUBLIC,
    }

    it('必须调用 verifyUploadedObject 校验 storageKey 真实性', async () => {
      await service.create(createDto, normalUser)

      expect(mockR2StorageService.verifyUploadedObject).toHaveBeenCalledWith(
        createDto.storageKey,
        normalUser.uid,
        createDto.fileSize,
      )
    })

    it('校验失败时应阻断落库，不执行数据库写入', async () => {
      ;(mockR2StorageService.verifyUploadedObject as jest.Mock).mockRejectedValue(
        new ForbiddenException('非法 storageKey'),
      )

      await expect(service.create(createDto, normalUser)).rejects.toThrow('非法 storageKey')
      expect(mockDocRepo.manager?.transaction).not.toHaveBeenCalled()
    })

    it('落库成功时：清理文件名、由服务端生成访问地址、状态初始化为 DRAFT', async () => {
      const doc = await service.create(createDto, normalUser)

      expect(doc.fileName).toBe('rule_test_.pdf')
      expect(doc.publicUrl).toBe('https://cdn.example.com/real-url.pdf')
      expect(doc.status).toBe(DocumentStatusEnum.DRAFT)
      expect(doc.createBy).toBe(normalUser.uid)
      expect(mockManager.save).toHaveBeenCalledTimes(1)
      expect(mockApprovalService.appendRecord).toHaveBeenCalledTimes(1)
    })

    it('捕获 storageKey 唯一索引冲突 (ER_DUP_ENTRY) 并转为友好提示', async () => {
      const dupError = new QueryFailedError('query', [], new Error('duplicate'))
      ;(dupError as any).driverError = { code: 'ER_DUP_ENTRY' }

      ;(mockDocRepo.manager?.transaction as jest.Mock).mockRejectedValue(dupError)

      await expect(service.create(createDto, normalUser)).rejects.toThrow(
        '该文件已被关联到其他文档，不可重复提交',
      )
    })
  })

  describe('findByCode', () => {
    it('文档不存在时抛出 NotFoundException', async () => {
      ;(mockDocRepo.findOne as jest.Mock).mockResolvedValue(null)

      await expect(service.findByCode('non_exist_code', normalUser)).rejects.toThrow(
        NotFoundException,
      )
    })

    it('无权访问私密文档时抛出 ForbiddenException', async () => {
      const privateDoc = {
        docCode: 'doc_priv',
        scope: DocumentScopeEnum.PRIVATE,
        createBy: otherUser.uid,
      } as DocumentEntity

      ;(mockDocRepo.findOne as jest.Mock).mockResolvedValue(privateDoc)

      await expect(service.findByCode('doc_priv', normalUser)).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('有权访问时返回文档详情与审批流历史', async () => {
      const publicDoc = {
        docCode: 'doc_pub',
        scope: DocumentScopeEnum.PUBLIC,
        createBy: otherUser.uid,
      } as DocumentEntity

      ;(mockDocRepo.findOne as jest.Mock).mockResolvedValue(publicDoc)
      ;(mockApprovalService.findHistoryByCode as jest.Mock).mockResolvedValue([{ id: 1 }])

      const result = await service.findByCode('doc_pub', normalUser)
      expect(result.document).toBe(publicDoc)
      expect(result.approvalHistory).toHaveLength(1)
    })
  })

  describe('deleteByCode', () => {
    it('非管理员且非作者删除他人文档时，抛出 ForbiddenException 且不删除 R2 文件', async () => {
      const othersDoc = {
        docCode: 'doc_del_01',
        createBy: otherUser.uid,
        storageKey: 'key_01',
      } as DocumentEntity

      ;(mockManager.findOne as jest.Mock).mockResolvedValue(othersDoc)

      await expect(service.deleteByCode('doc_del_01', normalUser)).rejects.toThrow(
        ForbiddenException,
      )

      expect(mockR2StorageService.deleteFile).not.toHaveBeenCalled()
    })

    it('作者或管理员删除成功：事务内删除数据库记录，提交后调用 R2 清理物理文件', async () => {
      const myDoc = {
        docCode: 'doc_del_02',
        createBy: normalUser.uid,
        storageKey: 'knowledge/docs/sample.pdf',
      } as DocumentEntity

      ;(mockManager.findOne as jest.Mock).mockResolvedValue(myDoc)

      await service.deleteByCode('doc_del_02', normalUser)

      expect(mockApprovalService.deleteByDocCode).toHaveBeenCalledWith(mockManager, 'doc_del_02')
      expect(mockManager.delete).toHaveBeenCalledWith(DocumentEntity, { docCode: 'doc_del_02' })
      expect(mockR2StorageService.deleteFile).toHaveBeenCalledWith('knowledge/docs/sample.pdf')
    })
  })

  describe('getDocumentAccessUrl', () => {
    it('文档不存在时抛出 NotFoundException', async () => {
      ;(mockDocRepo.findOne as jest.Mock).mockResolvedValue(null)

      await expect(
        service.getDocumentAccessUrl('not_exist_key', normalUser),
      ).rejects.toThrow(NotFoundException)
    })

    it('非作者无权访问他人私密文档时抛出 ForbiddenException', async () => {
      const privateDoc = {
        storageKey: 'priv_key',
        scope: DocumentScopeEnum.PRIVATE,
        createBy: otherUser.uid,
      } as DocumentEntity

      ;(mockDocRepo.findOne as jest.Mock).mockResolvedValue(privateDoc)

      await expect(
        service.getDocumentAccessUrl('priv_key', normalUser),
      ).rejects.toThrow(ForbiddenException)
    })

    it('作者可获取私密文档的授权预签名链接', async () => {
      const myPrivateDoc = {
        storageKey: 'my_priv_key',
        scope: DocumentScopeEnum.PRIVATE,
        createBy: normalUser.uid,
      } as DocumentEntity

      ;(mockDocRepo.findOne as jest.Mock).mockResolvedValue(myPrivateDoc)

      const url = await service.getDocumentAccessUrl('my_priv_key', normalUser)
      expect(url).toBe('https://r2.example.com/get-signed')
      expect(mockR2StorageService.generatePresignedGetUrl).toHaveBeenCalledWith('my_priv_key')
    })
  })

  describe('findAll', () => {
    it('正确应用分页与数据权限隔离过滤', async () => {
      const mockQb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 1 }], 1]),
      }
      ;(mockDocRepo.createQueryBuilder as jest.Mock).mockReturnValue(mockQb)

      const res = await service.findAll(
        { page: 2, pageSize: 20, keyword: '手册', status: DocumentStatusEnum.DRAFT },
        normalUser,
      )

      expect(mockQb.skip).toHaveBeenCalledWith(20)
      expect(mockQb.take).toHaveBeenCalledWith(20)
      expect(mockQb.andWhere).toHaveBeenCalledWith('(doc.title LIKE :kw OR doc.file_name LIKE :kw)', {
        kw: '%手册%',
      })
      expect(res.total).toBe(1)
      expect(res.items).toHaveLength(1)
    })
  })
})
