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
`
]
const invalid_examples = [
`123 $!@#$%^`,
`()`,
`$`
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
        it('should have a string type', function() {
            validResults.forEach(result => {
                const parsedChunk = result
                const Nodes = getNodesOfType('Node', parsedChunk)
                Nodes.forEach(node => {
                    assert.isString(node.type)
                })
            })
        })
    })
    describe('Chunk', function() {
        it('should have body nodes of type "Statement"', function() {
            validResults.forEach(result => {
                const parsedChunk = result
                const Chunks = getNodesOfType('Chunk', parsedChunk)
                Chunks.forEach(chunk => {
                    chunk.body.forEach(bodyNode => {
                        assert.isTrue(ParsedLua.expect("Statement")(bodyNode))
                    })
                })
            })
        })
    })
})