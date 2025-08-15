for file in *.js; do
  javascript-obfuscator "$file" --output "../criptografia/modulos/$file"
done