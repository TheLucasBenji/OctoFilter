// Permite importar archivos CSS en TypeScript/TSX
declare module '*.css' {
  const classes: { [key: string]: string };
  export default classes;
}
