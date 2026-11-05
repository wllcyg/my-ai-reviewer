import os
import zipfile

OUT_DIR = '/Users/moliang/Desktop/coder/my-ai-reviewer/test-samples'
os.makedirs(OUT_DIR, exist_ok=True)

# -------------------------------------------------------------
# 1. 生成真实标准 DOCX 文档 (员工出差与报销管理办法.docx)
# -------------------------------------------------------------
def create_docx(filepath):
    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>'''

    rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

    document_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>第一章 员工出差与报销管理细则</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>本制度旨在明确公司各部门出差申请、预付款以及差旅费用的审批流程与报销标准。</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>一、差旅住宿与交通补贴标准</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>员工职级</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>一线城市住宿上限</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>非一线城市住宿上限</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>每日餐补</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>普通员工</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>500元/天</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>350元/天</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>100元</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>部门总监及以上</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>800元/天</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>600元/天</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>150元</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>二、发票报销特别注意事项</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>1. 所有报销必须凭合规增值税专用发票或普通发票，并在返回公司后7个工作日内提交。</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>2. 超出预算标准的费用需单独提交CEO特批邮件。</w:t></w:r>
    </w:p>
  </w:body>
</w:document>'''

    with zipfile.ZipFile(filepath, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', content_types)
        z.writestr('_rels/.rels', rels)
        z.writestr('word/document.xml', document_xml)

docx_path = os.path.join(OUT_DIR, '01_员工出差与报销管理办法.docx')
create_docx(docx_path)
print(f'✅ 已生成: {docx_path}')

# -------------------------------------------------------------
# 2. 生成多 Sheet 的 XLSX 电子表格 (2026年度业务预算与支出表.xlsx)
# -------------------------------------------------------------
def create_xlsx(filepath):
    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>'''

    rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>'''

    workbook_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="研发与硬件预算" sheetId="1" r:id="rId1"/>
    <sheet name="市场与运营推广" sheetId="2" r:id="rId2"/>
    <sheet name="待定项目储备(空)" sheetId="3" r:id="rId3"/>
  </sheets>
</workbook>'''

    workbook_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>'''

    strings = [
        "项目类别", "预算科目", "Q1计划金额", "负责人",
        "云服务费", "GPU算力租赁", "500000", "张工",
        "硬件采购", "开发机与测试终端", "120000", "李工",
        "渠道推广", "搜索引擎推广", "300000", "王经理",
        "行业展会", "2026人工智能峰会展位", "150000", "赵经理"
    ]
    
    sst_items = "".join([f"<si><t>{s}</t></si>" for s in strings])
    shared_strings_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="{len(strings)}" uniqueCount="{len(strings)}">
  {sst_items}
</sst>'''

    # Sheet 1: 研发
    sheet1_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="s"><v>2</v></c>
      <c r="D1" t="s"><v>3</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>4</v></c>
      <c r="B2" t="s"><v>5</v></c>
      <c r="C2" t="s"><v>6</v></c>
      <c r="D2" t="s"><v>7</v></c>
    </row>
    <row r="3">
      <c r="A3" t="s"><v>8</v></c>
      <c r="B3" t="s"><v>9</v></c>
      <c r="C3" t="s"><v>10</v></c>
      <c r="D3" t="s"><v>11</v></c>
    </row>
  </sheetData>
</worksheet>'''

    # Sheet 2: 市场
    sheet2_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="s"><v>2</v></c>
      <c r="D1" t="s"><v>3</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>12</v></c>
      <c r="B2" t="s"><v>13</v></c>
      <c r="C2" t="s"><v>14</v></c>
      <c r="D2" t="s"><v>15</v></c>
    </row>
    <row r="3">
      <c r="A3" t="s"><v>16</v></c>
      <c r="B3" t="s"><v>17</v></c>
      <c r="C3" t="s"><v>18</v></c>
      <c r="D3" t="s"><v>19</v></c>
    </row>
  </sheetData>
</worksheet>'''

    # Sheet 3: 空 Sheet
    sheet3_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData/>
</worksheet>'''

    with zipfile.ZipFile(filepath, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', content_types)
        z.writestr('_rels/.rels', rels)
        z.writestr('xl/workbook.xml', workbook_xml)
        z.writestr('xl/_rels/workbook.xml.rels', workbook_rels)
        z.writestr('xl/sharedStrings.xml', shared_strings_xml)
        z.writestr('xl/worksheets/sheet1.xml', sheet1_xml)
        z.writestr('xl/worksheets/sheet2.xml', sheet2_xml)
        z.writestr('xl/worksheets/sheet3.xml', sheet3_xml)

xlsx_path = os.path.join(OUT_DIR, '02_2026年度业务预算与支出表.xlsx')
create_xlsx(xlsx_path)
print(f'✅ 已生成: {xlsx_path}')

# -------------------------------------------------------------
# 3. 生成 PPTX 幻灯片 (2026企业级AI中台建设方案.pptx)
# -------------------------------------------------------------
def create_pptx(filepath):
    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>'''

    rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>'''

    presentation_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
    <p:sldId id="257" r:id="rId2"/>
  </p:sldIdLst>
</p:presentation>'''

    presentation_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
</Relationships>'''

    # Slide 1: 封面大纲
    slide1_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:p><a:r><a:t>2026 企业级 AI 智能评审中台方案</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Subtitle"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:p><a:r><a:t>汇报人：技术架构部 | 日期：2026年11月</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>'''

    # Slide 2: 方案要点
    slide2_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="Header"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:p><a:r><a:t>核心系统架构与业务收益</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="5" name="Content"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:p><a:r><a:t>1. 统一策略模式文档解析引擎（支持 Word/Excel/PPT/TXT）</a:t></a:r></a:p>
          <a:p><a:r><a:t>2. 智能前置拦截：防篡改魔数校验、旧版 Office 格式拦截</a:t></a:r></a:p>
          <a:p><a:r><a:t>3. 审查效率预期提升 85%，审单流转从 2 天压缩至 10 分钟</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>'''

    with zipfile.ZipFile(filepath, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', content_types)
        z.writestr('_rels/.rels', rels)
        z.writestr('ppt/presentation.xml', presentation_xml)
        z.writestr('ppt/_rels/presentation.xml.rels', presentation_rels)
        z.writestr('ppt/slides/slide1.xml', slide1_xml)
        z.writestr('ppt/slides/slide2.xml', slide2_xml)

pptx_path = os.path.join(OUT_DIR, '03_2026企业级AI中台建设方案.pptx')
create_pptx(pptx_path)
print(f'✅ 已生成: {pptx_path}')

# -------------------------------------------------------------
# 4. 生成 CSV 测试文件 (04_用户权限清单.csv)
# -------------------------------------------------------------
csv_path = os.path.join(OUT_DIR, '04_用户权限清单.csv')
with open(csv_path, 'w', encoding='utf-8') as f:
    f.write('用户ID,真实姓名,所属部门,系统角色,状态\n')
    f.write('1001,张三,研发架构部,超级管理员,正常\n')
    f.write('1002,李四,财务风控部,审批专员,正常\n')
    f.write('1003,王五,行政运营部,普通员工,只读\n')
print(f'✅ 已生成: {csv_path}')

# -------------------------------------------------------------
# 5. 生成冒充文件 (05_伪造为DOCX的文本.docx) -> 用于测试魔数拦截
# -------------------------------------------------------------
fake_path = os.path.join(OUT_DIR, '05_伪造为DOCX的纯文本(测试拦截).docx')
with open(fake_path, 'w', encoding='utf-8') as f:
    f.write('这是一个将普通文本文件直接修改后缀名为 .docx 的伪造文件。用于测试 ZIP 文件头魔数拦截功能。')
print(f'✅ 已生成: {fake_path}')

