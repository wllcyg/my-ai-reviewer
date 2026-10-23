## MCP 学习

### MCP 是什么

MCP 的全称是 Model Context Protocol(模型上下文协议),是目前主流的开放通信协议,统一了 Agent 调用外部工具和数据源的规范。除了工具(Tools),它还支持资源(Resources)和提示词模板(Prompts),本文只讲最常用的工具部分。

### 为什么需要 MCP

大模型本身只能生成文本,查天气、读文件、查数据库这些事,都需要借助外部工具。

在 MCP 出现之前,每个 AI 应用都要为每个工具单独写一套对接代码,工具和应用各有各的格式,互相不通用。

MCP 的思路类似 USB-C 接口:**工具方按统一的格式提供能力,AI 应用按统一的格式调用**,双方不需要再逐个适配。一个 MCP server 写好后,Claude Desktop、Cursor 等支持 MCP 的应用都能直接使用。

### MCP 里有哪些角色

- **Host(宿主)**:用户使用的 AI 应用,如 Claude Desktop、Cursor。
- **Client(客户端)**:运行在 Host 内部,负责与 MCP server 建立连接、收发消息。
- **Server(服务端)**:提供具体工具的程序,比如"查天气"的服务。

### 一次调用是怎么发生的

以"北京今天天气怎么样"为例:

1. Client 连接 Server,获取它提供的工具列表(名称、描述、参数)。
2. 工具列表连同用户的问题一起交给大模型。
3. 大模型根据**工具描述**判断需要调用 `get_weather`,并生成参数 `{ "location": "beijing" }`。
4. Client 把调用请求发给 Server,Server 执行后返回结果。
5. 结果回到大模型,大模型据此组织语言回答用户。

第 3 步正是后文强调"工具描述很重要"的原因:模型只能靠描述来决定调不调、怎么调。

### MCP 的工具描述格式

每个工具都通过 JSON Schema 来描述:叫什么、做什么、接受什么参数。人和大模型都能据此理解这个工具,也方便大模型调用。

```json
{
  "name": "get_weather",
  "description": "Get the weather in a specific location",
  "inputSchema": {
    "type": "object",
    "properties": {
      "location": {
        "type": "string",
        "description": "The location to get the weather for"
      }
    },
    "required": ["location"]
  }
}
```

### MCP 的传输方式

MCP 的消息格式是 JSON-RPC 2.0,目前支持两种传输方式:

1. **stdio**:客户端(Agent)启动后,把 MCP server 作为**子进程**拉起,双方通过标准输入/输出交换消息。没有网络开销,速度快,适合本地开发和调试工具。
2. **Streamable HTTP**:MCP server 独立部署,对外暴露一个 HTTP 端点,客户端用 POST 发送消息,服务端可以通过 SSE 流式返回结果。它方便做权限管理、Token 管理,所以企业应用大多采用这种方式。

两种方式传输的消息内容完全相同,区别只在于用什么通道送达。

一次完整的交互流程是:先初始化连接(`initialize`),再获取工具列表(`tools/list`),最后调用具体工具(`tools/call`)。

以调用天气工具为例,客户端发送:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_weather",
    "arguments": { "location": "beijing" }
  }
}
```

服务端返回:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "北京:晴,22℃" }]
  }
}
```

### MCP 工具的描述信息

在实际开发中,MCP 工具的描述信息非常重要。它是写给**模型**看的,模型据此判断**是否调用、何时调用、参数怎么填**,因此直接决定工具被调用的准确率。

下面是实践中总结的推荐写法(不属于协议规范,但很有效)。

#### 一份好的描述应包含五个要素

| 要素 | 作用 |
|---|---|
| 功能句 | 一句话说清做什么、返回什么 |
| `Use when` | 说明触发场景 |
| `Do NOT use when` | 指出反例,并指向替代工具 |
| `Returns` | 说明返回结构 |
| `Notes` | 交代前置步骤、副作用和限制 |

#### 参数与设计要点

- **参数**要写清含义、示例值与约束,并尽量用 `enum`、`minimum` 等 schema 代替文字约束。
- **单一职责**:一个工具只做一件事。
- **命名**采用"动词_名词",如 `get_component_props`。
- **控制返回体积**:提供 `limit` 或分页,避免撑爆上下文。
- **报错信息**要给出修正建议,让模型能自行纠错。

#### 示例

```json
{
  "name": "get_component_props",
  "description": "解析本地业务组件源码,返回其 props、emits、slots 的结构化定义。\nUse when: 用户要使用、封装或排查某个已有业务组件。\nDo NOT use when: 不知道准确组件名(先调用 search_components);目标是第三方库组件如 element-plus。\nReturns: { name, props: [{ name, type, required, default }], emits, slots }。\nNotes: 组件名区分大小写;默认不返回源码,includeSource=true 时返回体积会明显变大。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "componentName": {
        "type": "string",
        "description": "组件名,大小写敏感,例如 'UserSelector'。不要带路径或扩展名。"
      },
      "includeSource": {
        "type": "boolean",
        "default": false,
        "description": "是否同时返回组件源码,仅在需要阅读实现细节时设为 true。"
      }
    },
    "required": ["componentName"]
  }
}
```

对应的错误信息也应带上修正建议:

```text
未找到组件 'UserSelecter'。是否想查找 'UserSelector'?可调用 search_components 进行模糊搜索。
```

#### 持续迭代

描述没有一次到位的完美版本。需要用真实提问反复测试,检查有没有**漏调、误调或选错工具**,每次只改一处,再回归验证。

### 小结

- MCP 是统一 Agent 与外部工具对接方式的开放协议,类似 AI 世界的 USB-C。
- 架构上分为 Host、Client、Server 三个角色。
- 工具用 JSON Schema 描述,消息格式为 JSON-RPC 2.0,传输方式有 stdio(本地)和 Streamable HTTP(服务化部署)。
- 大模型靠工具描述决定是否调用,所以描述要写得清楚、具体,并通过真实提问持续迭代。