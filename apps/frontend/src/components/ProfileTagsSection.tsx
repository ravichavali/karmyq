import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type TagType = 'skill' | 'interest' | 'need';

interface Tag {
  id: string;
  tag_value: string;
  skill_slug: string | null;
}

interface TagGroupState {
  tags: Tag[];
  suggestions: string[];
  adding: boolean;
  inputValue: string;
}

const SECTION_CONFIG: { type: TagType; label: string; placeholder: string; description: string }[] = [
  { type: 'skill',    label: 'Skills',    placeholder: 'e.g. Carpentry, Spanish tutoring...', description: 'What can you offer?' },
  { type: 'interest', label: 'Interests', placeholder: 'e.g. Urban gardening, Food access...', description: 'What do you care about?' },
  { type: 'need',     label: 'Needs',     placeholder: 'e.g. Rides on weekdays, Help moving...', description: 'What might you need?' },
];

export function ProfileTagsSection() {
  const [error, setError] = useState('');
  const [groups, setGroups] = useState<Record<TagType, TagGroupState>>({
    skill:    { tags: [], suggestions: [], adding: false, inputValue: '' },
    interest: { tags: [], suggestions: [], adding: false, inputValue: '' },
    need:     { tags: [], suggestions: [], adding: false, inputValue: '' },
  });

  useEffect(() => {
    api.get('/auth/profile/tags').then(res => {
      const { skills, interests, needs } = res.data;
      setGroups(prev => ({
        skill:    { ...prev.skill,    tags: skills },
        interest: { ...prev.interest, tags: interests },
        need:     { ...prev.need,     tags: needs },
      }));
    }).catch(() => setError('Could not load your tags. Please try again later.'));

    (['skill', 'interest', 'need'] as TagType[]).forEach(type => {
      api.get(`/auth/profile/tags/suggestions?tag_type=${type}`).then(res => {
        setGroups(prev => ({ ...prev, [type]: { ...prev[type], suggestions: res.data } }));
      }).catch(() => { /* Suggestions are optional; free-text entry remains available. */ });
    });
  }, []);

  const addTag = async (type: TagType, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (groups[type].tags.length >= 10) return;
    try {
      const res = await api.post('/auth/profile/tags', { tag_type: type, tag_value: trimmed });
      if (res.data) {
        setGroups(prev => ({
          ...prev,
          [type]: {
            ...prev[type],
            tags: [...prev[type].tags, res.data],
            adding: false,
            inputValue: '',
          },
        }));
      }
    } catch {
      setError('Could not add this tag. Please try again.');
    }
  };

  const removeTag = async (type: TagType, tagId: string) => {
    try {
      await api.delete(`/auth/profile/tags/${tagId}`);
      setGroups(prev => ({
        ...prev,
        [type]: { ...prev[type], tags: prev[type].tags.filter(t => t.id !== tagId) },
      }));
    } catch {
      setError('Could not remove this tag. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">About You</h2>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      {SECTION_CONFIG.map(({ type, label, placeholder, description }) => {
        const group = groups[type];
        return (
          <div key={type}>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-medium text-gray-700">{label}</h3>
              <span className="text-xs text-gray-400">{description}</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {group.tags.map(tag => (
                <span key={tag.id} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-50 text-green-800 text-sm">
                  {tag.tag_value}
                  {type === 'skill' && tag.skill_slug && (
                    <span className="text-xs text-text-muted">
                      matched to {tag.skill_slug.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())}
                    </span>
                  )}
                  <button onClick={() => removeTag(type, tag.id)} className="text-green-500 hover:text-green-700 ml-1">✕</button>
                </span>
              ))}
              {!group.adding && (
                <button
                  onClick={() => setGroups(prev => ({ ...prev, [type]: { ...prev[type], adding: true } }))}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 text-sm hover:border-green-400 hover:text-green-600"
                >
                  + Add
                </button>
              )}
            </div>
            {group.adding && (
              <div className="flex flex-col gap-2">
                <input
                  autoFocus
                  type="text"
                  value={group.inputValue}
                  onChange={e => setGroups(prev => ({ ...prev, [type]: { ...prev[type], inputValue: e.target.value } }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addTag(type, group.inputValue);
                    if (e.key === 'Escape') setGroups(prev => ({ ...prev, [type]: { ...prev[type], adding: false, inputValue: '' } }));
                  }}
                  placeholder={placeholder}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-green-300 w-full max-w-xs"
                />
                {group.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {group.suggestions
                      .filter(s => s.toLowerCase().includes(group.inputValue.trim().toLowerCase()))
                      .filter(s => !group.tags.some(t => t.tag_value === s))
                      .slice(0, 6).map(s => (
                      <button key={s} onClick={() => addTag(type, s)} className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {group.tags.length >= 10 && (
                  <p className="text-xs text-amber-600">You&apos;ve added 10 {label.toLowerCase()} — consider removing one first.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
