// Extend JSX intrinsic elements to allow the `jsx` prop on <style> tags.
// Next.js styled-jsx uses this syntax; TypeScript does not know about it
// natively. Not a runtime issue — safe to suppress.
declare namespace React {
  interface StyleHTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}
