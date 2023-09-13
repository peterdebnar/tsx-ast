
import * as ts from "typescript"
import * as fs from "fs"
import readline from "readline"

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

rl.question('Enter path to input folder: ', (inputPath: string) => {
  rl.question('Enter path to output folder: ', (outputPath: string) => {
    rl.question('Enter entityName: ', (eName: string) => {
      let path: string = inputPath
      let targetPath: string = outputPath
      let entityName: string = eName
      
      path = path.endsWith("/") ? path.slice(0, -1) : path     
      targetPath = targetPath.endsWith("/") ? targetPath.slice(0, -1) : targetPath
      entityName = entityName.toLowerCase()

      editSystemFiles(path, "", targetPath, entityName)

      rl.close()
    })
  })
})

function rename (inputString: string, entityName: string): string {
  let newString: string = inputString.replace("Entity", `${entityName.charAt(0).toUpperCase()}${entityName.slice(1)}`)
  newString = newString.replace("entity", entityName)
  
  return newString
}

function getAst(filePath: string): ts.SourceFile {                  
  const sourceCode: string = fs.readFileSync(filePath, "utf-8")
  const sourceFile: ts.SourceFile = ts.createSourceFile(
    "temp.tsx",
    sourceCode,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TSX
  )

  return sourceFile
}

function modifyAst(ast: ts.SourceFile, entityName: string): string {

  const transformerFactory: ts.TransformerFactory<ts.Node> = (
    context: ts.TransformationContext
  ) => {
    return (rootNode: ts.Node) => {
      function visit(node: ts.Node): any{
        node = ts.visitEachChild(node, visit, context)

        if (ts.isCallExpression(node)) {
          if (ts.isIdentifier(node.expression)) {

            const modifiedIdentifier: ts.Identifier = ts.factory.createIdentifier(rename(node.expression.text, entityName))
            return ts.factory.createCallExpression(modifiedIdentifier, undefined, node.arguments)
          }
        }
        else if (ts.isStringLiteral(node)) {

          return ts.factory.createStringLiteral(rename(node.text, entityName))
        }
        
        else if (ts.isFunctionDeclaration(node)) {
          if (node.name && ts.isIdentifier(node.name)) {

            const modifiedIdentifier: ts.Identifier = ts.factory.createIdentifier(rename(node.name.text, entityName))

            return ts.factory.createFunctionDeclaration(
              node.modifiers,
              node.asteriskToken,
              modifiedIdentifier,
              node.typeParameters,
              node.parameters,
              node.type,
              node.body)
          }
        }  
        
        else {
          return node
        }
      }
      return ts.visitNode(rootNode, visit)
    
    }
  }
  const transformationResult: ts.TransformationResult<ts.Node> = ts.transform(ast, [transformerFactory])

  const transformedSourceFile: ts.Node = transformationResult.transformed[0]
  const printer: ts.Printer = ts.createPrinter()

  const result: string = printer.printNode(
      ts.EmitHint.Unspecified,
      transformedSourceFile,
      ast
  )

  return result
}

function editSystemFiles(originalPath: string, subfolderPath: string, targetPath: string, entityName: string): void {    
  const currentPath: string = subfolderPath ? `${originalPath}/${subfolderPath}` : originalPath
  fs.readdir(currentPath, (error, files) => {
    if (error) {
      console.log(error)
    } else {
      files.forEach((file) => {
        let newSubFolderPath = subfolderPath ? `${subfolderPath}/${file}` : `/${file}`

        if (fs.lstatSync(`${currentPath}/${file}`).isDirectory()) {
          fs.mkdir(`${targetPath}${newSubFolderPath}`, (error) => {
            if (error) {
              console.log(error)
            }
          })
          editSystemFiles(originalPath, newSubFolderPath, targetPath, entityName)
        } else if (file.substring(file.length - 4) === ".tsx") {
          let ast: ts.SourceFile = getAst(`${originalPath}${newSubFolderPath}`)
          let codeString = modifyAst(ast, entityName)

          const newFile = rename(file, entityName)
          newSubFolderPath = subfolderPath ? `${subfolderPath}/${newFile}` : `/${newFile}`

          fs.writeFile(`${targetPath}${newSubFolderPath}`, codeString, (error) => {
            if (error) {
              console.log(error)
            }
          })
        } else {
          fs.copyFile(`${originalPath}${newSubFolderPath}`, `${targetPath}${newSubFolderPath}`, (error) => {
            if (error) {
              console.log(error)
            }
          })
        }
      })
    }
  })
}
