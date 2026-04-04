// Next.js styled-jsx uses <style jsx> syntax TypeScript doesn't recognize natively.
// Not a runtime issue — safe to suppress.
declare namespace React {
  interface StyleHTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}
