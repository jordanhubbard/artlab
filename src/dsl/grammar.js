/**
 * Artlab DSL Grammar Specification (EBNF)
 * Version: 0.1.0
 *
 * EBNF Notation:
 *   ::=    definition
 *   |      alternation
 *   [ ]    optional (zero or one)
 *   { }    repetition (zero or more)
 *   ( )    grouping
 *   " "    terminal string
 *   //     comment (in EBNF text only)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ARTLAB DSL EBNF GRAMMAR
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * program         ::= { statement } EOF
 *
 * statement       ::= useDecl
 *                   | sceneDecl
 *                   | functionDecl
 *                   | letDecl
 *
 * // ── Imports ──────────────────────────────────────────────────────────────
 * useDecl         ::= "use" ( stdPath | urlPath )
 * stdPath         ::= IDENT { "/" IDENT }
 * urlPath         ::= "url" ":" STRING
 *
 * // ── Scene ─────────────────────────────────────────────────────────────────
 * sceneDecl       ::= "scene" IDENT "{" { sceneItem } "}"
 * sceneItem       ::= cameraBlock
 *                   | objectDecl
 *                   | letDecl
 *                   | eventHandler
 *                   | functionDecl
 *
 * // ── Camera ───────────────────────────────────────────────────────────────
 * cameraBlock     ::= "camera" IDENT "{" { propAssign } "}"
 *
 * // ── Object ───────────────────────────────────────────────────────────────
 * objectDecl      ::= "object" IDENT "{" { objectItem } "}"
 * objectItem      ::= propAssign
 *                   | materialBlock
 *                   | lightBlock
 *                   | physicsBlock
 *
 * // ── Material ─────────────────────────────────────────────────────────────
 * materialBlock   ::= "material" IDENT "{" { propAssign } "}"
 *
 * // ── Light ────────────────────────────────────────────────────────────────
 * lightBlock      ::= "light" IDENT "{" { propAssign } "}"
 *
 * // ── Physics ──────────────────────────────────────────────────────────────
 * physicsBlock    ::= "physics" IDENT "{" { propAssign } "}"
 *
 * // ── Property Assignment ──────────────────────────────────────────────────
 * propAssign      ::= IDENT ":" expr
 *
 * // ── Event Handler ────────────────────────────────────────────────────────
 * eventHandler    ::= "on" eventSpec "{" { bodyStmt } "}"
 * eventSpec       ::= IDENT ":" IDENT [ "(" [ argList ] ")" ]
 *
 * // ── Function Declaration ─────────────────────────────────────────────────
 * functionDecl    ::= "fn" IDENT "(" [ paramList ] ")" "{" { bodyStmt } "}"
 * paramList       ::= IDENT { "," IDENT }
 *
 * // ── Body Statements ──────────────────────────────────────────────────────
 * bodyStmt        ::= letDecl
 *                   | returnStmt
 *                   | ifStmt
 *                   | repeatStmt
 *                   | animateStmt
 *                   | toggleStmt
 *                   | exprStmt
 *
 * letDecl         ::= "let" IDENT "=" expr
 * returnStmt      ::= "return" [ expr ]
 * ifStmt          ::= "if" "(" expr ")" "{" { bodyStmt } "}" [ "else" "{" { bodyStmt } "}" ]
 * repeatStmt      ::= "repeat" "(" expr ")" "{" { bodyStmt } "}"
 * animateStmt     ::= "animate" memberExprOrIdent "from" expr "to" expr "over" expr [ "ease" ":" IDENT ]
 * toggleStmt      ::= "toggle" memberExprOrIdent
 * exprStmt        ::= expr
 *
 * memberExprOrIdent ::= IDENT { "." IDENT }
 *
 * // ── Expressions ──────────────────────────────────────────────────────────
 * expr            ::= logicalOr
 * logicalOr       ::= logicalAnd { "||" logicalAnd }
 * logicalAnd      ::= equality   { "&&" equality }
 * equality        ::= relational { ( "==" | "!=" ) relational }
 * relational      ::= additive   { ( "<" | ">" | "<=" | ">=" ) additive }
 * additive        ::= multiplicative { ( "+" | "-" ) multiplicative }
 * multiplicative  ::= unary      { ( "*" | "/" ) unary }
 * unary           ::= ( "!" | "-" ) unary
 *                   | primary
 * primary         ::= NUMBER [ UNIT ]
 *                   | STRING
 *                   | COLOR
 *                   | BOOL
 *                   | vecLiteral
 *                   | callExpr
 *                   | memberExpr
 *                   | IDENT
 *                   | "(" expr ")"
 *
 * vecLiteral      ::= "(" expr "," expr [ "," expr ] ")"
 * callExpr        ::= IDENT "(" [ argList ] ")"
 * memberExpr      ::= IDENT { "." IDENT } [ "(" [ argList ] ")" ]
 * argList         ::= expr { "," expr }
 *
 * // ── Terminals ────────────────────────────────────────────────────────────
 * IDENT           ::= [a-zA-Z_][a-zA-Z0-9_]*   // excluding keywords
 * NUMBER          ::= [0-9]+ [ "." [0-9]+ ] [ ("e"|"E") ["+" | "-"] [0-9]+ ]
 * STRING          ::= '"' { any char except '"' or backslash-escape } '"'
 * COLOR           ::= "#" [0-9a-fA-F]{6}
 * BOOL            ::= "true" | "false"
 * UNIT            ::= "AU" | "km" | "m" | "deg" | "rad" | "s" | "ms" | "days"
 *
 * // ── Keywords ─────────────────────────────────────────────────────────────
 * // use, scene, object, material, light, physics, camera, fn, let, if, else,
 * // return, on, animate, toggle, from, to, over, ease, repeat
 *
 * // ── Comments ─────────────────────────────────────────────────────────────
 * LINE_COMMENT    ::= "//" { any char except newline } newline
 * BLOCK_COMMENT   ::= "/" "*" { any char } "*" "/"
 */

export const ARTLAB_GRAMMAR = `
Artlab DSL EBNF Grammar v0.1.0

program         ::= { statement } EOF
statement       ::= useDecl | sceneDecl | functionDecl | letDecl
useDecl         ::= "use" ( stdPath | urlPath )
stdPath         ::= IDENT { "/" IDENT }
urlPath         ::= "url" ":" STRING
sceneDecl       ::= "scene" IDENT "{" { sceneItem } "}"
sceneItem       ::= cameraBlock | objectDecl | letDecl | eventHandler | functionDecl
cameraBlock     ::= "camera" IDENT "{" { propAssign } "}"
objectDecl      ::= "object" IDENT "{" { objectItem } "}"
objectItem      ::= propAssign | materialBlock | lightBlock | physicsBlock
materialBlock   ::= "material" IDENT "{" { propAssign } "}"
lightBlock      ::= "light" IDENT "{" { propAssign } "}"
physicsBlock    ::= "physics" IDENT "{" { propAssign } "}"
propAssign      ::= IDENT ":" expr
eventHandler    ::= "on" eventSpec "{" { bodyStmt } "}"
eventSpec       ::= IDENT ":" IDENT [ "(" [ argList ] ")" ]
functionDecl    ::= "fn" IDENT "(" [ paramList ] ")" "{" { bodyStmt } "}"
paramList       ::= IDENT { "," IDENT }
bodyStmt        ::= letDecl | returnStmt | ifStmt | repeatStmt | animateStmt | toggleStmt | exprStmt
letDecl         ::= "let" IDENT "=" expr
returnStmt      ::= "return" [ expr ]
ifStmt          ::= "if" "(" expr ")" "{" { bodyStmt } "}" [ "else" "{" { bodyStmt } "}" ]
repeatStmt      ::= "repeat" "(" expr ")" "{" { bodyStmt } "}"
animateStmt     ::= "animate" memberExprOrIdent "from" expr "to" expr "over" expr [ "ease" ":" IDENT ]
toggleStmt      ::= "toggle" memberExprOrIdent
expr            ::= logicalOr
logicalOr       ::= logicalAnd { "||" logicalAnd }
logicalAnd      ::= equality   { "&&" equality }
equality        ::= relational { ( "==" | "!=" ) relational }
relational      ::= additive   { ( "<" | ">" | "<=" | ">=" ) additive }
additive        ::= multiplicative { ( "+" | "-" ) multiplicative }
multiplicative  ::= unary { ( "*" | "/" ) unary }
unary           ::= ( "!" | "-" ) unary | primary
primary         ::= NUMBER [ UNIT ] | STRING | COLOR | BOOL | vecLiteral | callExpr | memberExpr | IDENT | "(" expr ")"
vecLiteral      ::= "(" expr "," expr [ "," expr ] ")"
callExpr        ::= IDENT "(" [ argList ] ")"
argList         ::= expr { "," expr }
`;

export const DSL_VERSION = '0.1.0';
