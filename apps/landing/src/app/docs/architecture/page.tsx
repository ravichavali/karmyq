import MarkdownContent from '@/components/docs/MarkdownContent';
import architectureData from '@/data/docs/architecture.json';

export default function ArchitecturePage() {
  return (
    <div>
      <h1 className="heading-2 mb-6">{architectureData.title}</h1>
      <MarkdownContent content={architectureData.content} />

      {architectureData.dependencyGraph && (
        <div className="mt-12 border-t border-karmyq-brown-100 pt-8">
          <h2 className="heading-3 mb-4">Dependency Graph</h2>
          <MarkdownContent content={architectureData.dependencyGraph} />
        </div>
      )}
    </div>
  );
}
