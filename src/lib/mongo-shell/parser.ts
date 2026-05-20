/**
 * Mongo shell subset parser — runs in a Next.js route handler over visitor input.
 *
 * MUST NOT use eval / new Function — anything that defers to JS execution would
 * let visitors run arbitrary code in our serverless runtime. The parser is a
 * hand-written tokenizer + recursive-descent over the subset of Mongo shell
 * syntax exercised by `.sources/API-JASKIS/commands.js`:
 *
 *   use <db>
 *   show collections | show dbs
 *   db.<collection>.find( [filter [, projection]] )
 *   db.<collection>.findOne( [filter [, projection]] )
 *   db.<collection>.insertOne( doc )
 *   db.<collection>.insertMany( [doc, ...] )
 *   db.<collection>.updateOne( filter, update )
 *   db.<collection>.updateMany( filter, update )
 *   db.<collection>.deleteOne( filter )
 *   db.<collection>.deleteMany( filter )
 *   db.<collection>.countDocuments( [filter] )
 *   db.createCollection( name )
 *
 * Cursor methods chained after find / findOne:
 *   .pretty()    .limit(n)    .sort({field: 1})
 *
 * Literals supported: numbers, strings (single or double-quoted with backslash
 * escapes), `true` / `false` / `null`, objects (Mongo-style — bare or quoted
 * keys), arrays. Operator keys ($gte, $set, $and, etc.) are parsed as plain
 * strings — semantics happen in the translator.
 *
 * Anything outside the grammar above throws ParseError with a friendly,
 * shell-like message — visitors see "unsupported in museum: regex literals"
 * rather than a stack trace.
 */

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly position: number,
  ) {
    super(message);
    this.name = "ParseError";
  }
}

// ─── AST ─────────────────────────────────────────────────────────────────

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export interface CursorChain {
  /** Order of application — visitor wrote .sort then .limit, we preserve. */
  ops: CursorOp[];
}

export type CursorOp =
  | { type: "pretty" }
  | { type: "limit"; n: number }
  | { type: "sort"; spec: { [field: string]: 1 | -1 } };

export type ParsedCommand =
  | { type: "use"; db: string }
  | { type: "showCollections" }
  | { type: "showDbs" }
  | { type: "createCollection"; name: string }
  | {
      type: "find" | "findOne";
      collection: string;
      filter: Json;
      projection: Json | null;
      cursor: CursorChain;
    }
  | { type: "insertOne"; collection: string; doc: Json }
  | { type: "insertMany"; collection: string; docs: Json[] }
  | {
      type: "updateOne" | "updateMany";
      collection: string;
      filter: Json;
      update: Json;
    }
  | { type: "deleteOne" | "deleteMany"; collection: string; filter: Json }
  | { type: "countDocuments"; collection: string; filter: Json };

// ─── Public entry ────────────────────────────────────────────────────────

export function parseCommand(input: string): ParsedCommand {
  const p = new Parser(input);
  const cmd = p.parseStatement();
  p.expectEnd();
  return cmd;
}

// ─── Implementation ──────────────────────────────────────────────────────

class Parser {
  private pos = 0;
  constructor(private readonly src: string) {}

  parseStatement(): ParsedCommand {
    this.skipWhitespace();
    // Bare `use <db>` is not JS syntax — handle as a line directive.
    if (this.matchKeyword("use")) {
      const name = this.readBareIdentOrString();
      return { type: "use", db: name };
    }
    if (this.matchKeyword("show")) {
      const what = this.readBareIdentOrString();
      if (what === "collections") return { type: "showCollections" };
      if (what === "dbs" || what === "databases") return { type: "showDbs" };
      throw this.error(
        `unsupported in museum: 'show ${what}'. try 'show collections' or 'show dbs'`,
      );
    }
    return this.parseDbCall();
  }

  private parseDbCall(): ParsedCommand {
    this.skipWhitespace();
    if (!this.matchKeyword("db")) {
      throw this.error(
        "expected `use ...`, `show ...`, or `db.<collection>...`",
      );
    }
    this.expect(".");
    const head = this.readIdent();

    // db.createCollection("name")
    if (head === "createCollection") {
      this.expect("(");
      this.skipWhitespace();
      const name = this.readStringLiteral();
      this.skipWhitespace();
      this.expect(")");
      return { type: "createCollection", name };
    }

    // db.<collection>.<op>(...)
    const collection = head;
    this.expect(".");
    const op = this.readIdent();
    this.expect("(");
    this.skipWhitespace();

    switch (op) {
      case "find":
      case "findOne":
        return this.finishFind(op, collection);

      case "insertOne": {
        const doc = this.parseJson();
        this.skipWhitespace();
        this.expect(")");
        if (!isObject(doc)) {
          throw this.error("insertOne(...) requires a document object");
        }
        return { type: "insertOne", collection, doc };
      }

      case "insertMany": {
        const docs = this.parseJson();
        this.skipWhitespace();
        this.expect(")");
        if (!Array.isArray(docs)) {
          throw this.error("insertMany(...) requires an array of documents");
        }
        for (const d of docs) {
          if (!isObject(d)) {
            throw this.error("insertMany(...) entries must be objects");
          }
        }
        return { type: "insertMany", collection, docs };
      }

      case "updateOne":
      case "updateMany": {
        const filter = this.parseJson();
        this.skipWhitespace();
        this.expect(",");
        this.skipWhitespace();
        const update = this.parseJson();
        this.skipWhitespace();
        this.expect(")");
        if (!isObject(filter) || !isObject(update)) {
          throw this.error(`${op}(filter, update) requires two objects`);
        }
        return { type: op, collection, filter, update };
      }

      case "deleteOne":
      case "deleteMany": {
        const filter = this.parseJson();
        this.skipWhitespace();
        this.expect(")");
        if (!isObject(filter)) {
          throw this.error(`${op}(filter) requires a filter object`);
        }
        return { type: op, collection, filter };
      }

      case "countDocuments": {
        let filter: Json = {};
        // Optional argument
        if (this.peek() !== ")") {
          filter = this.parseJson();
          this.skipWhitespace();
        }
        this.expect(")");
        if (!isObject(filter)) {
          throw this.error("countDocuments(filter?) requires an object filter");
        }
        return { type: "countDocuments", collection, filter };
      }

      default:
        throw this.error(`unsupported in museum: db.${collection}.${op}(...)`);
    }
  }

  private finishFind(
    op: "find" | "findOne",
    collection: string,
  ): ParsedCommand {
    let filter: Json = {};
    let projection: Json | null = null;
    if (this.peek() !== ")") {
      filter = this.parseJson();
      this.skipWhitespace();
      if (this.peek() === ",") {
        this.consume();
        this.skipWhitespace();
        projection = this.parseJson();
        this.skipWhitespace();
      }
    }
    this.expect(")");
    if (!isObject(filter)) {
      throw this.error(`${op}(filter, projection?) requires an object filter`);
    }
    if (projection !== null && !isObject(projection)) {
      throw this.error(`${op}(_, projection) requires an object projection`);
    }
    const cursor = this.parseCursorChain();
    return { type: op, collection, filter, projection, cursor };
  }

  private parseCursorChain(): CursorChain {
    const ops: CursorOp[] = [];
    for (;;) {
      this.skipWhitespace();
      if (this.peek() !== ".") return { ops };
      // Lookahead to avoid eating a stray dot that doesn't begin a cursor op.
      const save = this.pos;
      this.consume(); // .
      const name = this.tryReadIdent();
      if (!name) {
        this.pos = save;
        return { ops };
      }
      this.skipWhitespace();
      if (this.peek() !== "(") {
        // Identifier without call — not a cursor op. Rewind.
        this.pos = save;
        return { ops };
      }
      this.consume(); // (
      this.skipWhitespace();
      switch (name) {
        case "pretty": {
          this.skipWhitespace();
          this.expect(")");
          ops.push({ type: "pretty" });
          break;
        }
        case "limit": {
          const n = this.parseJson();
          this.skipWhitespace();
          this.expect(")");
          if (typeof n !== "number" || !Number.isInteger(n) || n < 0) {
            throw this.error(".limit(n) requires a non-negative integer");
          }
          ops.push({ type: "limit", n });
          break;
        }
        case "sort": {
          const spec = this.parseJson();
          this.skipWhitespace();
          this.expect(")");
          if (!isObject(spec)) {
            throw this.error(".sort(spec) requires an object");
          }
          const normalized: { [field: string]: 1 | -1 } = {};
          for (const [k, v] of Object.entries(spec)) {
            if (v !== 1 && v !== -1) {
              throw this.error(
                `.sort: field "${k}" must be 1 (ascending) or -1 (descending)`,
              );
            }
            normalized[k] = v;
          }
          ops.push({ type: "sort", spec: normalized });
          break;
        }
        default:
          throw this.error(`unsupported cursor method: .${name}(...)`);
      }
    }
  }

  // ─── JSON-ish literal parser ──────────────────────────────────────────

  private parseJson(): Json {
    this.skipWhitespace();
    const c = this.peek();
    if (c === "{") return this.parseObject();
    if (c === "[") return this.parseArray();
    if (c === '"' || c === "'") return this.readStringLiteral();
    if (c === "-" || (c >= "0" && c <= "9")) return this.readNumber();
    // bare identifier — true/false/null
    const id = this.tryReadIdent();
    if (id === "true") return true;
    if (id === "false") return false;
    if (id === "null") return null;
    throw this.error(
      `unexpected token: ${id ? `'${id}'` : c ? `'${c}'` : "<eof>"}`,
    );
  }

  private parseObject(): { [key: string]: Json } {
    this.expect("{");
    const out: { [key: string]: Json } = {};
    this.skipWhitespace();
    if (this.peek() === "}") {
      this.consume();
      return out;
    }
    for (;;) {
      this.skipWhitespace();
      // Keys may be bare identifiers (Mongo style), string-quoted, or
      // start with $ (operators).
      let key: string;
      const c = this.peek();
      if (c === '"' || c === "'") {
        key = this.readStringLiteral();
      } else if (c === "$" || isIdentStart(c) || /[0-9]/.test(c)) {
        key = this.readBareKey();
      } else {
        throw this.error(`expected object key, got '${c}'`);
      }
      this.skipWhitespace();
      this.expect(":");
      const val = this.parseJson();
      out[key] = val;
      this.skipWhitespace();
      if (this.peek() === ",") {
        this.consume();
        continue;
      }
      this.expect("}");
      return out;
    }
  }

  private parseArray(): Json[] {
    this.expect("[");
    const out: Json[] = [];
    this.skipWhitespace();
    if (this.peek() === "]") {
      this.consume();
      return out;
    }
    for (;;) {
      out.push(this.parseJson());
      this.skipWhitespace();
      if (this.peek() === ",") {
        this.consume();
        continue;
      }
      this.expect("]");
      return out;
    }
  }

  // ─── Lexer primitives ─────────────────────────────────────────────────

  private peek(): string {
    return this.src[this.pos] ?? "";
  }

  private consume(): string {
    return this.src[this.pos++] ?? "";
  }

  private expect(s: string): void {
    this.skipWhitespace();
    if (this.src.startsWith(s, this.pos)) {
      this.pos += s.length;
      return;
    }
    throw this.error(`expected '${s}'`);
  }

  expectEnd(): void {
    this.skipWhitespace();
    if (this.pos < this.src.length) {
      throw this.error(
        `unexpected trailing input: '${this.src.slice(this.pos)}'`,
      );
    }
  }

  private skipWhitespace(): void {
    while (this.pos < this.src.length) {
      const c = this.src[this.pos]!;
      if (c === " " || c === "\t" || c === "\r" || c === "\n") {
        this.pos++;
        continue;
      }
      // Single-line comments (// ...) — handy if visitors paste code blocks.
      if (c === "/" && this.src[this.pos + 1] === "/") {
        while (this.pos < this.src.length && this.src[this.pos] !== "\n") {
          this.pos++;
        }
        continue;
      }
      break;
    }
  }

  private matchKeyword(kw: string): boolean {
    this.skipWhitespace();
    const save = this.pos;
    if (!this.src.startsWith(kw, this.pos)) return false;
    this.pos += kw.length;
    const next = this.src[this.pos];
    // Reject only if the keyword would be followed by an identifier character
    // (e.g. matching "db" against "database" or "db2"). A dot, paren, or
    // whitespace is a legal continuation — `db.bounties...` or `use jaskis`.
    if (next && isIdentPart(next)) {
      this.pos = save;
      return false;
    }
    return true;
  }

  private readIdent(): string {
    this.skipWhitespace();
    const id = this.tryReadIdent();
    if (!id) throw this.error("expected identifier");
    return id;
  }

  private tryReadIdent(): string | null {
    const start = this.pos;
    const c = this.src[this.pos];
    if (!c || !isIdentStart(c)) return null;
    this.pos++;
    while (this.pos < this.src.length && isIdentPart(this.src[this.pos]!)) {
      this.pos++;
    }
    return this.src.slice(start, this.pos);
  }

  private readBareKey(): string {
    // Object keys may start with $ (operators like $set, $gte, $and).
    this.skipWhitespace();
    const start = this.pos;
    const c = this.src[this.pos];
    if (!c) throw this.error("expected object key");
    if (c === "$" || isIdentStart(c) || /[0-9]/.test(c)) {
      this.pos++;
      while (this.pos < this.src.length) {
        const cc = this.src[this.pos]!;
        if (isIdentPart(cc) || cc === "$") {
          this.pos++;
        } else {
          break;
        }
      }
      return this.src.slice(start, this.pos);
    }
    throw this.error(`expected object key, got '${c}'`);
  }

  private readBareIdentOrString(): string {
    this.skipWhitespace();
    const c = this.peek();
    if (c === '"' || c === "'") return this.readStringLiteral();
    return this.readIdent();
  }

  private readStringLiteral(): string {
    const quote = this.consume();
    if (quote !== '"' && quote !== "'") {
      throw this.error("expected string literal");
    }
    let out = "";
    while (this.pos < this.src.length) {
      const c = this.src[this.pos]!;
      if (c === "\\") {
        const esc = this.src[this.pos + 1];
        if (esc === undefined) {
          throw this.error("unterminated escape sequence");
        }
        this.pos += 2;
        switch (esc) {
          case "n":
            out += "\n";
            break;
          case "t":
            out += "\t";
            break;
          case "r":
            out += "\r";
            break;
          case "\\":
            out += "\\";
            break;
          case "'":
            out += "'";
            break;
          case '"':
            out += '"';
            break;
          case "/":
            out += "/";
            break;
          default:
            // Unknown escape — Mongo shell forgives, pass through literally.
            out += esc;
        }
        continue;
      }
      if (c === quote) {
        this.pos++;
        return out;
      }
      out += c;
      this.pos++;
    }
    throw this.error("unterminated string literal");
  }

  private readNumber(): number {
    const start = this.pos;
    if (this.src[this.pos] === "-") this.pos++;
    while (this.pos < this.src.length && /[0-9]/.test(this.src[this.pos]!)) {
      this.pos++;
    }
    if (this.src[this.pos] === ".") {
      this.pos++;
      while (this.pos < this.src.length && /[0-9]/.test(this.src[this.pos]!)) {
        this.pos++;
      }
    }
    if (this.src[this.pos] === "e" || this.src[this.pos] === "E") {
      this.pos++;
      if (this.src[this.pos] === "+" || this.src[this.pos] === "-") this.pos++;
      while (this.pos < this.src.length && /[0-9]/.test(this.src[this.pos]!)) {
        this.pos++;
      }
    }
    const lex = this.src.slice(start, this.pos);
    const n = Number(lex);
    if (!Number.isFinite(n)) throw this.error(`invalid number: ${lex}`);
    return n;
  }

  private error(msg: string): ParseError {
    return new ParseError(`${msg} (at ${this.pos})`, this.pos);
  }
}

function isIdentStart(c: string): boolean {
  return /[A-Za-z_]/.test(c);
}

function isIdentPart(c: string): boolean {
  return /[A-Za-z0-9_]/.test(c);
}

function isObject(v: Json): v is { [key: string]: Json } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
