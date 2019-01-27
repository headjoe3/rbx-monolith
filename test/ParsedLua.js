const assert = require('chai').assert;
const ParsedLua = require('../out/compiler/ParsedLua');
const mlog = require('mocha-logger');

const valid_examples = [
``,
`local x = function() do do local y = 3 end end end`,
`
mytable = setmetatable({key1 = "value1"}, {
    __index = function(mytable, key)
     
       if key == "key2" then
          return "metatablevalue"
       else
          return mytable[key]
       end
    end
 })
 
 print(mytable.key1,mytable.key2)
`,
`
return nil
`,
`
local l=require(game:GetService("ReplicatedStorage").RobloxTS.Include.RuntimeLib)local f local m=require(l.getModule("rbx-roact",script.Parent).roact.lib)local a=require(l.getModule("rbx-roact-router",script.Parent).router.lib)local a=require(l.getModule("rbx-roact-router",script.Parent).router.lib)local b,a,i,g=a.Router,a.Switch,a.Route,a.Redirect local e={BackgroundTransparency=1;Size=UDim2.new(1,0,1,0)}local h={Position=UDim2.new(0.5,0,0.5,0);AnchorPoint=Vector2.new(0.5,0.5)}local k={BackgroundColor3=Color3.new(0.85,0.85,0.85);BorderSizePixel=0}local j={TextColor3=Color3.new(0.15,0.15,0.15);Font=Enum.Font.SourceSans;FontSize=Enum.FontSize.Size24}local c={TextColor3=Color3.new(0.15,0.15,0.15);Font=Enum.Font.SourceSansItalic;FontSize=Enum.FontSize.Size18}local d=m.Component:extend("HomePage")function d:render()return(m.createElement("Frame",l.Object_assign({Size=UDim2.new(0,300,0,400)},k,h),{m.createElement("UIListLayout",{FillDirection=Enum.FillDirection.Vertical,Padding=UDim.new(0,0),SortOrder=Enum.SortOrder.LayoutOrder}),["Label"]=m.createElement("TextLabel",l.Object_assign({LayoutOrder=0,Text=(("Matched URL '")..self.props.match.url).."'",Size=UDim2.new(1,0,0.25,0)},k,c)),["Home button"]=m.createElement("TextButton",l.Object_assign({LayoutOrder=1,Text="Home",Size=UDim2.new(1,0,0.25,0)},k,j)),["Menu 1 button"]=m.createElement("TextButton",l.Object_assign({LayoutOrder=2,Text="Go to Menu 1",Size=UDim2.new(1,0,0.25,0),[m.Event.MouseButton1Click]=function()self.props.router.redirect("/menu1")wait(2)self.props.router.redirect("/nowhere")end},k,j)),["Menu 2 button"]=m.createElement("TextButton",l.Object_assign({LayoutOrder=3,Text="Go to Menu 2",Size=UDim2.new(1,0,0.25,0),[m.Event.MouseButton1Click]=function()self.props.router.redirect("/menu2")end},k,j))}))end local a=(m.createElement("ScreenGui",{},{m.createElement(b,{caching=true},{m.createElement(a,{},{["Home"]=m.createElement(i,{priority=0,path="/home",component=d}),["Menu1"]=m.createElement(i,{priority=1,path="/menu1",render=function(a)return(m.createElement("TextLabel",l.Object_assign({Text="Menu 1; redirecting in 2 seconds...",Size=UDim2.new(0,300,0,80)},k,h,j)))end}),["Menu2"]=m.createElement(i,{priority=2,path="/menu2",render=function(a)return(m.createElement("Frame",l.Object_assign({},e),{m.createElement("TextLabel",l.Object_assign({Text="Menu 2; redirecting in 1 seconds...",Size=UDim2.new(0,300,0,80)},k,h,j)),m.createElement(g,{to="/nowhere",delay=1})}))end}),["Default Redirect"]=m.createElement(i,{priority=100,path="/",render=function(a)return(m.createElement("Frame",l.Object_assign({},e),{m.createElement("TextLabel",l.Object_assign({Text="",Size=UDim2.new(0,300,0,400)},k,h,j)),m.createElement(g,{to="/home"})}))end})})})}))m.mount(a,(game.Players.LocalPlayer):WaitForChild("PlayerGui"),"MainGui")f=function()end return f
`,
`
a = 'alo\\n123"'
a = "alo\\n123\\""
a = '\\97lo\\10\\04923"'
a = [[alo
123"]]
a = [==[
alo
123"]==]
`,
`
x = true and #(a + b - -c * d ^ h / (i .. j())) and 3 or 2 > 3 <= 5 == "Hello" % 10 ~= 7
`,
`export {x}`,
`export "default" {x}`,
`export {x = x}`,
`export {x = function() end}`,
`export {x = class "MyClass" {

}}`,
`export "default" {class "MyClass" {

}}`,
`export "MyClass" { class {

}}`,
`test "" (2)`,
`
local x = math.huge --test
local x = (0.00002)
local x = 8999999999999999999999999999999999999999999999
local x = 0.00
local x = 000000000000000000000000000000000000000000000000000009`,
``,
`return {} --test`,
`do
if x then
elseif y then
else
end
end`,
`for _,v in pairs(x) do end
while true do end
for i = 1, 2, 3 do end
for i = 1, 2 do end
for _,v in next, {} do break; return end`,
]
const invalid_examples = [
`123 $!@#$%^`,
`()`,
`$`,
`export default x`,
`export default function x() end`,
`export default class x do end`,
`for x[1], x[2] in pairs(x) do end`,
`for i = 1 do end`,
]

function getNodesOfType(type, root) {
    let matchingNodes = []
    // Add root element if it is a node
    if (root && typeof root === "object") {
        if (root.type && ParsedLua.expect(type)(root)) {
            matchingNodes.push(root)
        }
    }
    // Search nested objects for nodes
    for (const key in root) {
        const value = root[key]
        if (value && typeof value === "object") {
            matchingNodes = matchingNodes.concat(...getNodesOfType(type, value))
        }
    }
    return matchingNodes
}

function getParseResult(source) {
    try {
        const result = {success: true, result: ParsedLua.parse(source)}
        return result
    } catch (e) {
        const result = {success: false, message: e.message}
        return result
    }
}

function assertNodeType(type, node) {
    assert(ParsedLua.expect(type)(node), "Got unexpected node type " + ((node && node !== null) ? node.type : (typeof node)))
}
function assertNodeTypes(types, node) {
    let oneNodeTypeFound = false
    types.forEach(type => {
        oneNodeTypeFound = oneNodeTypeFound || ParsedLua.expect(type)(node)
    })
    assert(oneNodeTypeFound, "Got unexpected node type " + ((node && node !== null) ? node.type : (typeof node)))
}
function assertUnionLiterals(literals, value) {
    let inExpectedLiterals = false
    literals.forEach(literal => {
        if (value === literal) {
            inExpectedLiterals = true
        }
    })
    assert(inExpectedLiterals, "Got unexpected value '" + value + "'")
}
function assertNodeHasOptionalField(nodeType, field)  {
    let foundExampleWith = false
    let foundExampleWithout = false
    forEachValidExampleNode(nodeType, node => {
        if (node[field]) {
            foundExampleWith = true
        } else {
            foundExampleWithout = true
        }
    })
    assert.isOk(foundExampleWith && foundExampleWithout, `Found examples with field: ${foundExampleWith}; Found examples without field: ${foundExampleWithout}`)
}

// Get results for parsing valid lua examples
const validResults = []
valid_examples.forEach(example => {
    validResults.push(getParseResult(example))
})

// Get results for parsing invalid lua examples
const invalidResults = []
invalid_examples.forEach(example => {
    invalidResults.push(getParseResult(example))
})

/** Calls a callback for each valid node of a given type within the valid example results */
function forEachValidExampleNode(nodeType, func) {
    validResults.forEach(result => {
        const parsedChunk = result
        const Nodes = getNodesOfType(nodeType, parsedChunk)
        Nodes.forEach(node => {
            func(node)
        })
    })
}

describe('ParsedLua', function() {
    describe('parse', function() {
        it('should work for all valid examples', function() {
            validResults.forEach(result => {
                assert.equal(result.success, true, result.message)
            })
        })
        it('should not work for all invalid examples', function() {
            invalidResults.forEach((result, index) => {
                if (result.success) {
                    mlog.log(`Invalid example ${index} returned parsed chunk`, result.result)
                }
                assert.equal(result.success, false)
            })
        })
        it('should return a tree of testable nodes', function() {
            validResults.forEach((result, index) => {
                const parsedChunk = result
                const Nodes = getNodesOfType('Node', parsedChunk)
                mlog.log(`Valid example ${index}: Got ${Nodes.length} node${Nodes.length == 1 ? "" : "s"}`)
                Nodes.forEach(node => {
                    assert.isObject(node)
                })
            })
        })
    })
    describe('Node', function() {
        const NODE_TYPE = 'Node'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have a string type', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                assert.isString(node.type)
            })
        })
    })
    describe('Chunk', function() {
        const NODE_TYPE = 'Chunk'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have body nodes of type "Statement"', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                node.body.forEach(bodyNode => {
                    assertNodeType("Statement", bodyNode)
                })
            })
        })
        it('should have comments nodes of type "Comment"', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                node.comments.forEach(commentNode => {
                    assertNodeType("Comment", commentNode)
                })
            })
        })
    })
    describe('CallExpression', function() {
        const NODE_TYPE = 'CallExpression'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have base node of type "Expression"', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                assertNodeType("Expression", node.base)
            })
        })
    })
    describe('FunctionDeclaration', function() {
        const NODE_TYPE = 'FunctionDeclaration'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have identifier property of type "Identifier | MemberExpression | null"', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                assert.isTrue(
                    ParsedLua.expect("Identifier")(node.identifier)
                    || ParsedLua.expect("MemberExpression")(node.identifier)
                    || node.identifier === null,
                    "Got identifier type " + (node.identifier !== null && node.identifier.type)
                )
            })
        })
        it('should have isLocal property of type "boolean"', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                assert.isBoolean(node.isLocal)
            })
        })
        it('should have parameters property of type "Identifier[]"', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                node.parameters.forEach(formalParameter => {
                    assertNodeType("Identifier", formalParameter)
                })
            })
        })
        it('should have body property of type "Statement[]"', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                node.body.forEach(bodyNode => {
                    assertNodeType("Statement", bodyNode)
                })
            })
        })
    })
    describe('MemberExpression', function() {
        const NODE_TYPE = 'MemberExpression'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, node => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have indexer property of type ":" | "."', function() {
            const EXPECTED_LITERALS = [":", "."]
            forEachValidExampleNode(NODE_TYPE, node => {
                let inExpectedLiterals = false
                EXPECTED_LITERALS.forEach(literal => {
                    if (node.indexer === literal) {
                        inExpectedLiterals = true
                    }
                })
                assert.isOk(inExpectedLiterals)
            })
        })
        it('should have identifier property of type "Identifier"', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                assertNodeType("Identifier", node.identifier)
            })
        })
        it('should have base property of type "Expression"', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                assertNodeType("Expression", node.base)
            })
        })
    })
    describe('TableConstructorExpression', function() {
        const NODE_TYPE = 'TableConstructorExpression'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have fields of type (TableKeyString | TableValue | TableKey)[]', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                node.fields.forEach(fieldNode => {
                    assertNodeTypes(["TableKeyString", "TableValue", "TableKey"], fieldNode)
                })
            })
        })
    })
    describe('TableKey', function() {
        const NODE_TYPE = 'TableKey'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have key of type Expression', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assertNodeType("Expression", node.key)
            })
        })
        it('should have value of type Expression', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assertNodeType("Expression", node.value)
            })
        })
    })
    describe('TableValue', function() {
        const NODE_TYPE = 'TableValue'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have value of type Expression', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assertNodeType("Expression", node.value)
            })
        })
    })
    describe('TableKeyString', function() {
        const NODE_TYPE = 'TableKeyString'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have key of type Identifier', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assertNodeType("Identifier", node.key)
            })
        })
        it('should have value of type Expression', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assertNodeType("Expression", node.value)
            })
        })
    })
    describe('IndexExpression', function() {
        const NODE_TYPE = 'IndexExpression'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have index of type Expression', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assertNodeType("Expression", node.index)
            })
        })
        it('should have base of type Expression', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assertNodeType("Expression", node.base)
            })
        })
    })
    describe('StringLiteral', function() {
        const NODE_TYPE = 'StringLiteral'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have raw property of type string', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assert.isString(node.raw)
            })
        })
        it('should have value property of type string', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assert.isString(node.value)
            })
        })
    })
    describe('NumericLiteral', function() {
        const NODE_TYPE = 'NumericLiteral'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have raw property of type string', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assert.isString(node.raw)
            })
        })
        it('should have value property of type number', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assert.isNumber(node.value)
            })
        })
    })
    describe('BooleanLiteral', function() {
        const NODE_TYPE = 'BooleanLiteral'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have raw property of type string', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assert.isString(node.raw)
            })
        })
        it('should have value property of type boolean', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assert.isBoolean(node.value)
            })
        })
    })
    describe('NilLiteral', function() {
        const NODE_TYPE = 'NilLiteral'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have raw property of type string', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assert.isString(node.raw)
            })
        })
        it('should have value property of type null', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assert.isNull(node.value)
            })
        })
    })
    describe('LogicalExpression', function() {
        const NODE_TYPE = 'LogicalExpression'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it("should have operator of type 'and' | 'or' | 'not'", function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assertUnionLiterals(['and', 'or', 'not'], node.operator)
            })
        })
        it('should have left of type Expression', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assertNodeType("Expression", node.left)
            })
        })
        it('should have right of type Expression', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assertNodeType("Expression", node.right)
            })
        })
    })
    describe('BinaryExpression', function() {
        const NODE_TYPE = 'BinaryExpression'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it(`should have operator of type '-' | '+' | '/' | "*" | "^" | "%" | ".." | "~=" | "==" | "<=" | ">=" | "<" | ">"`, function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assertUnionLiterals(['-', '+', '/', "*", "^", "%", "..", "~=", "==", "<=", ">=", "<", ">"], node.operator)
            })
        })
        it('should have left of type Expression', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assertNodeType("Expression", node.left)
            })
        })
        it('should have right of type Expression', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assertNodeType("Expression", node.right)
            })
        })
    })
    describe('UnaryExpression', function() {
        const NODE_TYPE = 'UnaryExpression'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it(`should have operator of type '-' | '#'`, function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assertUnionLiterals(['-', '#'], node.operator)
            })
        })
        it('should have argument of type Expression', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assertNodeType("Expression", node.argument)
            })
        })
    })
    describe('CallExpression', function() {
        const NODE_TYPE = 'CallExpression'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it(`should have arguments of Expression[]`, function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                node.arguments.forEach(argumentNode => {
                    assertNodeType('Expression', argumentNode)
                })
            })
        })
    })
    describe('TableCallExpression', function() {
        const NODE_TYPE = 'TableCallExpression'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it(`should have arguments of TableConstructorExpression`, function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assertNodeType('TableConstructorExpression', node.arguments)
            })
        })
    })
    describe('StringCallExpression', function() {
        const NODE_TYPE = 'StringCallExpression'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it(`should have argument of StringLiteral`, function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assertNodeType('StringLiteral', node.argument)
            })
        })
    })
    describe('LocalStatement', function() {
        const NODE_TYPE = 'LocalStatement'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it(`should have variables of type Identifier[]`, function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                node.variables.forEach(variableNode => {
                    assertNodeType('Identifier', variableNode)
                })
            })
        })
        it(`should have init of type Expression[]`, function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                node.init.forEach(expressionNode => {
                    assertNodeType('Expression', expressionNode)
                })
            })
        })
    })
    describe('CallStatement', function() {
        const NODE_TYPE = 'CallStatement'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it(`should have expression of type Call`, function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assertNodeType('Call', node.expression)
            })
        })
    })
    describe('AssignmentStatement', function() {
        const NODE_TYPE = 'AssignmentStatement'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it(`should have variables of type (Identifier | MemberExpression | IndexExpression)[]`, function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                node.variables.forEach(variableNode => {
                    assertNodeTypes(["Identifier", "MemberExpression", "IndexExpression"], variableNode)
                })
            })
        })
        it(`should have init of type Expression[]`, function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                node.init.forEach(expressionNode => {
                    assertNodeType('Expression', expressionNode)
                })
            })
        })
    })
    describe('ReturnStatement', function() {
        const NODE_TYPE = 'ReturnStatement'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it(`should have arguments of type Expression[]`, function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                node.arguments.forEach(expressionNode => {
                    assertNodeType('Expression', expressionNode)
                })
            })
        })
    })
    describe('FunctionDeclarationStatement', function() {
        const NODE_TYPE = 'FunctionDeclarationStatement'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have identifier property of type "Identifier | MemberExpression"', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                assertNodeTypes(["Identifier", "MemberExpression"], node.identifier)
            })
        })
    })
    describe('FunctionDeclarationExpression', function() {
        const NODE_TYPE = 'FunctionDeclarationExpression'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have identifier property of type "null"', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                assert.isNull(node.identifier)
            })
        })
    })
    describe('DoStatement', function() {
        const NODE_TYPE = 'DoStatement'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have body property of type "Statement[]"', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                node.body.forEach(bodyNode => {
                    assertNodeType("Statement", bodyNode)
                })
            })
        })
    })
    describe('IfStatement', function() {
        const NODE_TYPE = 'IfStatement'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have clauses property of type "Clause[]"', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                node.clauses.forEach(clauseNode => {
                    assertNodeType("Clause", clauseNode)
                })
            })
        })
    })
    describe('IfClause', function() {
        const NODE_TYPE = 'IfClause'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have condition property of type "Expression"', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                assertNodeType("Expression", node.condition)
            })
        })
        it('should have body property of type "Statement[]"', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                node.body.forEach(bodyNode => {
                    assertNodeType("Statement", bodyNode)
                })
            })
        })
    })
    describe('ElseifClause', function() {
        const NODE_TYPE = 'ElseifClause'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have condition property of type "Expression"', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                assertNodeType("Expression", node.condition)
            })
        })
        it('should have body property of type "Statement[]"', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                node.body.forEach(bodyNode => {
                    assertNodeType("Statement", bodyNode)
                })
            })
        })
    })
    describe('ElseClause', function() {
        const NODE_TYPE = 'ElseClause'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have body property of type "Statement[]"', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                node.body.forEach(bodyNode => {
                    assertNodeType("Statement", bodyNode)
                })
            })
        })
    })
    describe('Comment', function() {
        const NODE_TYPE = 'Comment'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have raw property of type string', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assert.isString(node.raw)
            })
        })
        it('should have value property of type string', function() {
            forEachValidExampleNode(NODE_TYPE, node => {
                assert.isString(node.value)
            })
        })
    })
    describe('ForGenericStatement', function() {
        const NODE_TYPE = 'ForGenericStatement'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have variables of type Identifier[]', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                node.variables.forEach(variablesNode => {
                    assertNodeType("Identifier", variablesNode)
                })
            })
        })
        it('should have iterators property of type "Expression[]"', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                node.iterators.forEach(iteratorNode => {
                    assertNodeType("Expression", iteratorNode)
                })
            })
        })
    })
    describe('ForNumericStatement', function() {
        const NODE_TYPE = 'ForNumericStatement'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have variable of type Identifier', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                assertNodeType("Identifier", node.variable)
            })
        })
        it('should have start of type Expression', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                assertNodeType("Expression", node.start)
            })
        })
        it('should have end of type Expression', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                assertNodeType("Expression", node.end)
            })
        })
        it('should have optional parameter step', function() {
            assertNodeHasOptionalField(NODE_TYPE, "step")
        })
        it('should have step of type Expression | null', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                assert.isTrue(
                    ParsedLua.expect("Expression")(node.step)
                    || node.step === null,
                    "Got step type " + (node.step !== null && node.step.type)
                )
            })
        })
    })
    describe('HasBody', function() {
        const NODE_TYPE = 'HasBody'
        it('should be found in at least one example', function() {
            let wasFound = false
            forEachValidExampleNode(NODE_TYPE, (node) => {
                wasFound = true
            })
            assert.isOk(wasFound)
        })
        it('should have body of type Statement[]', function() {
            forEachValidExampleNode(NODE_TYPE, (node) => {
                node.body.forEach(bodyNode => {
                    assertNodeType("Statement", bodyNode)
                })
            })
        })
    })
})