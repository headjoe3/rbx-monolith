export default class BaseLexer {
    private source: string
    position: number
    file_name: string
    constructor(source: string, file_name?: string) {
        if (file_name === undefined) { file_name = "src" }
    
        this.source = source
        this.file_name = file_name
        this.position = 0
    
        return this
    }
    consume(): string | undefined {
        const c = this.peek()
        this.move(1)
        return c
    }
    count(c: string, offset?: number): number {
        if (offset === undefined) { offset = 0 }
    
        let n = 0
    
        while (this.peek(offset + n) === c) {
            n = n + 1
        }
    
        return n
    }
    is_finished(): boolean {
        return this.position > this.source.length
    }
    peek(offset?: number): string | undefined {
        if (offset === undefined) { offset = 0 }
    
        // string.sub outside the boundary of self.source will return empty string
        // but we want it to return nil so it can evaluate to false
        if (!this.is_finished()) {
            return this.source.charAt(this.position + offset)
        }
    }
    move(by?: number) {
        if (by === undefined) { by = 0 }
    
        this.position = this.position + by
    }
    match(str: string): boolean {
        if (this.is_finished()) {
            return false
        }
    
        return this.source.substr(this.position, this.position + str.length - 1) === str
    }
    move_if_match(str: string) {
        let ok = this.match(str)
    
        if (ok) {
            this.move(str.length)
        }
    
        return ok
    }
}