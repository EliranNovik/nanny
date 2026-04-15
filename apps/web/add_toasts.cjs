const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

const missingToastsFile = '/tmp/missing_toasts.txt';
// Parse the missing toast file
const filesToUpdate = new Set();
fs.readFileSync(missingToastsFile, 'utf8').split('\n').forEach(line => {
  if (line.startsWith('/')) {
    filesToUpdate.add(line.split(':')[0]);
  }
});

let updatedCount = 0;

filesToUpdate.forEach(file => {
  // Skip non-TSX / non-hook files to avoid breaking rules of hooks
  if (!file.endsWith('.tsx') && !file.includes('/hooks/')) {
      console.log(`Skipping ${file} as it is neither a TSX component nor a hook`);
      return;
  }

  const code = fs.readFileSync(file, 'utf8');
  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy']
    });

    let needsImport = false;
    let hasUseToastImport = false;

    // Check existing import
    traverse(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value === '@/components/ui/toast') {
          hasUseToastImport = true;
        }
      }
    });

    traverse(ast, {
      CatchClause(path) {
        const catchBody = path.node.body.body;
        // Check if there is already an addToast inside the catch
        const hasAddToast = catchBody.some(node => 
          node.type === 'ExpressionStatement' &&
          node.expression.type === 'CallExpression' &&
          node.expression.callee.name === 'addToast'
        );

        if (!hasAddToast) {
            // Find parent component/hook
            let parentFn = path.findParent(p => p.isFunctionDeclaration() || p.isArrowFunctionExpression() || p.isFunctionExpression());
            
            // Best effort check if it's a hook/component (name starts with uppercase or 'use')
            let isComponentOrHook = false;
            let fnNameNode = null;

            if (parentFn) {
                if (parentFn.isFunctionDeclaration() && parentFn.node.id) {
                    fnNameNode = parentFn.node.id.name;
                } else if (parentFn.parentPath.isVariableDeclarator()) {
                    fnNameNode = parentFn.parentPath.node.id.name;
                }
                
                if (fnNameNode && (fnNameNode.startsWith('use') || fnNameNode[0] === fnNameNode[0].toUpperCase())) {
                    isComponentOrHook = true;
                } else if (!fnNameNode) {
                    // Could be an anonymous function inside a `useEffect` inside a component
                    // Let's traverse up to see if we are inside a component
                    let ancestorComp = parentFn.findParent(p => {
                        let name = null;
                        if (p.isFunctionDeclaration() && p.node.id) name = p.node.id.name;
                        else if (p.parentPath && p.parentPath.isVariableDeclarator()) name = p.parentPath.node.id.name;
                        return name && (name.startsWith('use') || name[0] === name[0].toUpperCase());
                    });
                    if (ancestorComp) {
                        isComponentOrHook = true;
                        parentFn = ancestorComp; // Register the hook to the outermost component
                    }
                }
            }

            if (isComponentOrHook) {
                needsImport = true;
                
                // Generate addToast AST
                const errorVar = path.node.param ? path.node.param.name : 'error';
                const toastAst = parser.parse(`addToast({ title: "Error", description: ${path.node.param ? `(${errorVar} as any)?.message` : '"An unexpected error occurred"'} || "An unexpected error occurred.", variant: "error" });`, { sourceType: 'module' }).program.body[0];
                
                path.node.body.body.push(toastAst);
                
                // Add `const { addToast } = useToast();` inside the component body if not exists
                const fnBody = parentFn.node.body;
                if (fnBody && fnBody.type === 'BlockStatement') {
                    const hasHook = fnBody.body.some(stmt => {
                        return stmt.type === 'VariableDeclaration' && 
                          stmt.declarations.some(decl => decl.init && decl.init.callee && decl.init.callee.name === 'useToast');
                    });
                    if (!hasHook) {
                         const hookAst = parser.parse(`const { addToast } = useToast();`, { sourceType: 'module' }).program.body[0];
                         fnBody.body.unshift(hookAst);
                    }
                }
            }
        }
      }
    });

    if (needsImport && !hasUseToastImport) {
       const importAst = parser.parse(`import { useToast } from "@/components/ui/toast";`, { sourceType: 'module' }).program.body[0];
       ast.program.body.unshift(importAst);
    }
    
    if (needsImport) {
        const output = generate(ast, { retainLines: false }, code);
        fs.writeFileSync(file, output.code);
        console.log(`Updated ${file}`);
        updatedCount++;
    }
  } catch(e) {
    console.error(`Failed to parse/update ${file}: ${e.message}`);
  }
});

console.log(`Successfully updated ${updatedCount} files.`);
