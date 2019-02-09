# rbx-monolith
Compiles multiple lua files into a single lua file for each entry point in a project

## Example

lua_src/client.lua (entry point)
```lua
greet = import("shareddependency")

greet("Client")
```

lua_src/server.lua (entry point)
```lua
greet = import("shareddependency")

greet("Server")
```

lua_src/shareddependency.lua
```lua
greet = function(whom)
    print("Hello, " .. whom .. "!")
end

export(greet)
```

#### Output:

lua_out/client.lua
```lua
local shareddependency_greet
do
     shareddependency_greet = function(whom)
          print("Hello, " .. whom .. "!")
     end
end
shareddependency_greet("Client")
```

lua_out/server.lua
```lua
local shareddependency_greet
do
     shareddependency_greet = function(whom)
          print("Hello, " .. whom .. "!")
     end
end
shareddependency_greet("Server")
```
