import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { trustQuestionsService } from '@/lib/api'
import Layout from '@/components/Layout'
import { requireAdmin, isAdmin } from '@/utils/admin-auth'
import type { TrustQuestion } from '@/lib/answersToConfig'

export default function TrustQuestionsAdminPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [questions, setQuestions] = useState<TrustQuestion[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  // Edit state for questions
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)
  const [questionDraft, setQuestionDraft] = useState<{ question_text: string; subtext: string; display_order: number; active: boolean } | null>(null)

  // New question form
  const [showNewForm, setShowNewForm] = useState(false)
  const [newQuestion, setNewQuestion] = useState({ slug: '', question_text: '', subtext: '', display_order: 0 })

  // Edit state for choices
  const [editingChoice, setEditingChoice] = useState<string | null>(null)
  const [choiceDraft, setChoiceDraft] = useState<{ label: string; description: string; config_delta: string; display_order: number } | null>(null)

  useEffect(() => {
    if (!requireAdmin(router)) { setAuthChecked(true); return }
    setAuthChecked(true)
  }, [router])

  useEffect(() => {
    if (authChecked && isAdmin()) fetchQuestions()
  }, [authChecked])

  async function fetchQuestions() {
    try {
      setLoading(true)
      const res = await trustQuestionsService.list()
      setQuestions(res.data.data.questions)
      setError('')
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to load questions')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveQuestion(id: string) {
    if (!questionDraft) return
    setSaving(id)
    try {
      await trustQuestionsService.updateQuestion(id, questionDraft)
      await fetchQuestions()
      setEditingQuestion(null)
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Failed to save question')
    } finally {
      setSaving(null)
    }
  }

  async function handleDeactivateQuestion(id: string) {
    if (!confirm('Deactivate this question? It will no longer appear in the questionnaire.')) return
    setSaving(id)
    try {
      await trustQuestionsService.deleteQuestion(id)
      await fetchQuestions()
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Failed to deactivate question')
    } finally {
      setSaving(null)
    }
  }

  async function handleCreateQuestion() {
    if (!newQuestion.slug || !newQuestion.question_text) return
    setSaving('new')
    try {
      await trustQuestionsService.createQuestion({ ...newQuestion, display_order: Number(newQuestion.display_order) })
      await fetchQuestions()
      setShowNewForm(false)
      setNewQuestion({ slug: '', question_text: '', subtext: '', display_order: 0 })
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Failed to create question')
    } finally {
      setSaving(null)
    }
  }

  async function handleSaveChoice(questionId: string, choiceId: string) {
    if (!choiceDraft) return
    setSaving(choiceId)
    try {
      let config_delta: object
      try { config_delta = JSON.parse(choiceDraft.config_delta) }
      catch { alert('config_delta must be valid JSON'); setSaving(null); return }
      await trustQuestionsService.updateChoice(questionId, choiceId, {
        label: choiceDraft.label,
        description: choiceDraft.description,
        config_delta,
        display_order: choiceDraft.display_order,
      })
      await fetchQuestions()
      setEditingChoice(null)
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Failed to save choice')
    } finally {
      setSaving(null)
    }
  }

  async function handleDeleteChoice(questionId: string, choiceId: string) {
    if (!confirm('Delete this choice permanently?')) return
    setSaving(choiceId)
    try {
      await trustQuestionsService.deleteChoice(questionId, choiceId)
      await fetchQuestions()
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Failed to delete choice')
    } finally {
      setSaving(null)
    }
  }

  if (!authChecked) return null

  return (
    <Layout>
      <Head><title>Trust Questions — Admin</title></Head>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-text-muted mb-1">
              <Link href="/admin/schemas" className="hover:text-text">Admin</Link>
              <span>/</span>
              <span>Trust Questions</span>
            </div>
            <h1 className="text-2xl font-bold text-text">Trust Questions</h1>
            <p className="text-sm text-text-muted mt-1">
              Manage the questionnaire that shapes community config during creation.
            </p>
          </div>
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="px-4 py-2 bg-primary text-white text-sm rounded hover:bg-primary-dark"
          >
            + Add Question
          </button>
        </div>

        {error && <div className="mb-4 rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        {/* New question form */}
        {showNewForm && (
          <div className="mb-6 rounded-lg border border-border bg-surface p-6 space-y-4">
            <h3 className="font-semibold text-text">New Question</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Slug (unique)</label>
                <input type="text" value={newQuestion.slug} onChange={e => setNewQuestion(p => ({ ...p, slug: e.target.value }))}
                  className="w-full border border-border rounded px-3 py-2 text-sm" placeholder="e.g. who_is_this_for" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Display Order</label>
                <input type="number" value={newQuestion.display_order} onChange={e => setNewQuestion(p => ({ ...p, display_order: Number(e.target.value) }))}
                  className="w-full border border-border rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Question Text</label>
              <input type="text" value={newQuestion.question_text} onChange={e => setNewQuestion(p => ({ ...p, question_text: e.target.value }))}
                className="w-full border border-border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Subtext (optional)</label>
              <input type="text" value={newQuestion.subtext} onChange={e => setNewQuestion(p => ({ ...p, subtext: e.target.value }))}
                className="w-full border border-border rounded px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-3">
              <button onClick={handleCreateQuestion} disabled={saving === 'new'} className="px-4 py-2 bg-primary text-white text-sm rounded hover:bg-primary-dark disabled:opacity-50">
                {saving === 'new' ? 'Creating...' : 'Create'}
              </button>
              <button onClick={() => setShowNewForm(false)} className="px-4 py-2 text-sm text-text-muted hover:text-text">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg bg-surface-raised animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map(question => (
              <div key={question.id} className="rounded-lg border border-border bg-surface overflow-hidden">
                {/* Question header */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-xs font-mono text-text-muted bg-surface-raised px-2 py-0.5 rounded">
                      order: {question.display_order}
                    </span>
                    {editingQuestion === question.id && questionDraft ? (
                      <div className="flex-1 space-y-2">
                        <input type="text" value={questionDraft.question_text}
                          onChange={e => setQuestionDraft(p => p ? { ...p, question_text: e.target.value } : p)}
                          className="w-full border border-border rounded px-3 py-1.5 text-sm" />
                        <div className="flex gap-2">
                          <input type="text" value={questionDraft.subtext}
                            onChange={e => setQuestionDraft(p => p ? { ...p, subtext: e.target.value } : p)}
                            className="flex-1 border border-border rounded px-3 py-1.5 text-xs text-text-muted" placeholder="Subtext" />
                          <input type="number" value={questionDraft.display_order}
                            onChange={e => setQuestionDraft(p => p ? { ...p, display_order: Number(e.target.value) } : p)}
                            className="w-20 border border-border rounded px-3 py-1.5 text-xs" placeholder="Order" />
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id={`active-${question.id}`} checked={questionDraft.active}
                            onChange={e => setQuestionDraft(p => p ? { ...p, active: e.target.checked } : p)} />
                          <label htmlFor={`active-${question.id}`} className="text-xs text-text-muted">Active</label>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-text text-sm">{question.question_text}</p>
                        {question.subtext && <p className="text-xs text-text-muted mt-0.5">{question.subtext}</p>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    {editingQuestion === question.id ? (
                      <>
                        <button onClick={() => handleSaveQuestion(question.id)} disabled={saving === question.id}
                          className="px-3 py-1.5 bg-primary text-white text-xs rounded disabled:opacity-50">
                          {saving === question.id ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={() => setEditingQuestion(null)} className="px-3 py-1.5 text-xs text-text-muted hover:text-text">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingQuestion(question.id); setQuestionDraft({ question_text: question.question_text, subtext: question.subtext ?? '', display_order: question.display_order, active: true }) }}
                          className="px-3 py-1.5 text-xs text-text-muted border border-border rounded hover:text-text">Edit</button>
                        <button onClick={() => handleDeactivateQuestion(question.id)} disabled={saving === question.id}
                          className="px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50">Deactivate</button>
                        <button onClick={() => setExpandedId(expandedId === question.id ? null : question.id)}
                          className="px-3 py-1.5 text-xs text-text-muted border border-border rounded hover:text-text">
                          {expandedId === question.id ? 'Hide choices' : `Choices (${question.choices.length})`}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Choices */}
                {expandedId === question.id && (
                  <div className="border-t border-border bg-surface-raised px-5 py-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">Choices</p>
                    {question.choices.map(choice => (
                      <div key={choice.value} className="rounded border border-border bg-surface p-4">
                        {editingChoice === choice.value + question.id && choiceDraft ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-text-muted mb-1">Label</label>
                                <input type="text" value={choiceDraft.label}
                                  onChange={e => setChoiceDraft(p => p ? { ...p, label: e.target.value } : p)}
                                  className="w-full border border-border rounded px-3 py-1.5 text-sm" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-text-muted mb-1">Display Order</label>
                                <input type="number" value={choiceDraft.display_order}
                                  onChange={e => setChoiceDraft(p => p ? { ...p, display_order: Number(e.target.value) } : p)}
                                  className="w-full border border-border rounded px-3 py-1.5 text-sm" />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-text-muted mb-1">Description</label>
                              <input type="text" value={choiceDraft.description}
                                onChange={e => setChoiceDraft(p => p ? { ...p, description: e.target.value } : p)}
                                className="w-full border border-border rounded px-3 py-1.5 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-text-muted mb-1">config_delta (JSON)</label>
                              <textarea value={choiceDraft.config_delta}
                                onChange={e => setChoiceDraft(p => p ? { ...p, config_delta: e.target.value } : p)}
                                rows={3} className="w-full border border-border rounded px-3 py-1.5 text-xs font-mono" />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleSaveChoice(question.id, choice.value)} disabled={saving === choice.value + question.id}
                                className="px-3 py-1.5 bg-primary text-white text-xs rounded disabled:opacity-50">
                                {saving === choice.value + question.id ? 'Saving...' : 'Save'}
                              </button>
                              <button onClick={() => setEditingChoice(null)} className="px-3 py-1.5 text-xs text-text-muted hover:text-text">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-text-muted">{choice.value}</span>
                                <span className="font-medium text-sm text-text">{choice.label}</span>
                              </div>
                              {choice.description && <p className="text-xs text-text-muted mt-0.5">{choice.description}</p>}
                              <pre className="text-xs text-text-muted mt-2 bg-surface-raised rounded px-2 py-1 overflow-x-auto">
                                {JSON.stringify(choice.config_delta, null, 2)}
                              </pre>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <button onClick={() => {
                                setEditingChoice(choice.value + question.id)
                                setChoiceDraft({
                                  label: choice.label,
                                  description: choice.description ?? '',
                                  config_delta: JSON.stringify(choice.config_delta, null, 2),
                                  display_order: choice.display_order,
                                })
                              }} className="px-3 py-1.5 text-xs text-text-muted border border-border rounded hover:text-text">Edit</button>
                              <button onClick={() => handleDeleteChoice(question.id, choice.value)}
                                disabled={saving === choice.value + question.id}
                                className="px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50">Delete</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
