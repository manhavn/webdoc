import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { buildTree, flattenTree, normalizeNode, ROOT_KEY, toId } from '../lib/docsTree';
import { slugify } from '../lib/utils';
import { useI18n } from '../i18n/I18nContext';
import Icon from '../components/Icons';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';

const EMPTY_FORM = {
  title: '',
  slug: '',
  path: '',
  pathOverride: false,
  parentId: '',
  group: false,
  order: 0,
  description: '',
  content: '',
  published: true,
};

function normalizePath(value) {
  const cleaned = String(value || '')
    .trim()
    .replace(/\/{2,}/g, '/');
  if (!cleaned) return '/';
  const withLeading = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  const withoutTrailing = withLeading.replace(/\/+$/, '');
  return withoutTrailing || '/';
}

function joinPath(parentPath, slug) {
  const base = normalizePath(parentPath || '/');
  const segment = String(slug || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (!segment) return base;
  return base === '/' ? `/${segment}` : `${base}/${segment}`;
}

function collectDescendants(nodes, id) {
  const byParent = new Map();
  nodes.forEach((node) => {
    if (!node.parentId) return;
    if (!byParent.has(node.parentId)) byParent.set(node.parentId, []);
    byParent.get(node.parentId).push(node);
  });
  const found = new Set();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop();
    (byParent.get(current) || []).forEach((child) => {
      if (found.has(child.id)) return;
      found.add(child.id);
      stack.push(child.id);
    });
  }
  return found;
}

function DocRow({
  node,
  depth,
  tree,
  expanded,
  first,
  last,
  movingId,
  onToggle,
  onAddChild,
  onEdit,
  onDelete,
  onMove,
}) {
  const { t } = useI18n();
  const children = tree.get(node.id) || [];
  const open = expanded.has(node.id);
  const busy = movingId === node.id;

  return (
    <Fragment>
      <div className="docs-row" style={{ '--depth': depth }}>
        <div className="docs-row-main">
          {children.length > 0 ? (
            <button
              type="button"
              className="docs-toggle"
              onClick={() => onToggle(node.id)}
              aria-expanded={open}
              aria-label={
                open
                  ? t('docs.ariaCollapse', { title: node.title })
                  : t('docs.ariaExpand', { title: node.title })
              }
            >
              <Icon
                name="down"
                size={16}
                className={open ? 'docs-caret' : 'docs-caret docs-caret-collapsed'}
              />
            </button>
          ) : (
            <span className="docs-toggle-spacer" aria-hidden="true" />
          )}

          <div className="docs-info">
            <div className="docs-title">
              <span className="docs-name">{node.title || t('docs.noTitle')}</span>
              <span className={`badge ${node.group ? 'badge-featured' : 'badge-muted'}`}>
                {node.group ? t('docs.badgeGroup') : t('docs.badgePage')}
              </span>
              <span className={`badge ${node.published ? 'badge-published' : 'badge-draft'}`}>
                {node.published ? t('docs.badgePublic') : t('docs.badgeHidden')}
              </span>
            </div>
            <div className="docs-meta">
              <code>{node.path || '—'}</code>
              <span>{t('docs.metaOrder', { order: node.order ?? 0 })}</span>
              {children.length > 0 && (
                <span>{t('docs.metaChildren', { count: children.length })}</span>
              )}
            </div>
          </div>

          <div className="docs-actions">
            <button
              type="button"
              className="icon-button"
              title={t('docs.addChild')}
              aria-label={t('docs.addChildAria', { title: node.title })}
              onClick={() => onAddChild(node)}
            >
              <Icon name="plus" size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              title={t('common.edit')}
              aria-label={t('docs.editAria', { title: node.title })}
              onClick={() => onEdit(node)}
            >
              <Icon name="edit" size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              title={t('docs.moveUp')}
              aria-label={t('docs.moveUpAria', { title: node.title })}
              disabled={first || busy}
              onClick={() => onMove(node, 'up')}
            >
              <Icon name="up" size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              title={t('docs.moveDown')}
              aria-label={t('docs.moveDownAria', { title: node.title })}
              disabled={last || busy}
              onClick={() => onMove(node, 'down')}
            >
              <Icon name="down" size={16} />
            </button>
            <button
              type="button"
              className="icon-button icon-button-danger"
              title={t('common.delete')}
              aria-label={t('docs.deleteAria', { title: node.title })}
              onClick={() => onDelete(node)}
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        </div>
      </div>

      {open &&
        children.map((child, index) => (
          <DocRow
            key={child.id}
            node={child}
            depth={depth + 1}
            tree={tree}
            expanded={expanded}
            first={index === 0}
            last={index === children.length - 1}
            movingId={movingId}
            onToggle={onToggle}
            onAddChild={onAddChild}
            onEdit={onEdit}
            onDelete={onDelete}
            onMove={onMove}
          />
        ))}
    </Fragment>
  );
}

export default function Docs() {
  const { t } = useI18n();
  const toast = useToast();

  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
  const [movingId, setMovingId] = useState(null);
  const initExpanded = useRef(false);

  const [editor, setEditor] = useState(null);
  const [original, setOriginal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const contentInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const roots = tree.get(ROOT_KEY) || [];
  const flat = useMemo(() => flattenTree(tree), [tree]);

  const groupCount = nodes.filter((node) => node.group).length;
  const pageCount = nodes.length - groupCount;
  const contentImages = useMemo(() => {
    const matches = form.content.match(/\/uploads\/[A-Za-z0-9._-]+/g) || [];
    return [...new Set(matches)];
  }, [form.content]);
;

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.listDocs();
      const list = (Array.isArray(data) ? data : data?.items || []).map(normalizeNode);
      setNodes(list);
      if (!initExpanded.current) {
        initExpanded.current = true;
        setExpanded(new Set(list.map((node) => node.id)));
      }
    } catch (err) {
      setError(err.message || t('docs.error'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleNode(id) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(nodes.map((node) => node.id)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  function nextOrder(parentId) {
    const siblings = nodes.filter((node) => (node.parentId || null) === (parentId || null));
    return siblings.reduce((max, node) => Math.max(max, Number(node.order) || 0), 0) + 1;
  }

  function openCreate(parent, group) {
    setForm({
      ...EMPTY_FORM,
      parentId: parent?.id || '',
      group: Boolean(group),
      order: nextOrder(parent?.id || null),
      published: true,
    });
    setOriginal(null);
    setFormError('');
    setEditor({ mode: 'create', parent: parent || null });
  }

  function openEdit(node) {
    setForm({
      title: node.title || '',
      slug: node.slug || '',
      path: '',
      pathOverride: false,
      parentId: node.parentId || '',
      group: Boolean(node.group),
      order: Number(node.order) || 0,
      description: node.description || '',
      content: node.content || '',
      published: node.published !== false,
    });
    setOriginal(node);
    setFormError('');
    setEditor({ mode: 'edit', node });
  }

  function closeEditor() {
    if (saving) return;
    setEditor(null);
    setOriginal(null);
    setFormError('');
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleTitleChange(event) {
    const title = event.target.value;
    setForm((current) => {
      const shouldSync = !current.slug || current.slug === slugify(current.title);
      return { ...current, title, slug: shouldSync ? slugify(title) : current.slug };
    });
  }

  const parentNode = nodes.find((node) => node.id === form.parentId) || null;
  const derivedSlug = slugify(form.slug) || slugify(form.title);
  const previewPath =
    form.pathOverride && form.path.trim()
      ? normalizePath(form.path)
      : joinPath(parentNode?.path || '/', derivedSlug || t('docs.pathPlaceholder'));

  const excludedParents = useMemo(() => {
    if (!editor || editor.mode !== 'edit' || !original) return new Set();
    const set = collectDescendants(nodes, original.id);
    set.add(original.id);
    return set;
  }, [editor, original, nodes]);

  const parentOptions = flat.filter((item) => !excludedParents.has(item.node.id));

  async function handleImageFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const { url } = await api.upload(file);
      const alt = file.name.replace(/\.[^.]+$/, '').replace(/"/g, '');
      const snippet = `\n<img src="${url}" alt="${alt}" loading="lazy">\n`;
      const textarea = contentInputRef.current;
      const current = form.content;
      const start = textarea?.selectionStart ?? current.length;
      const end = textarea?.selectionEnd ?? start;
      update('content', current.slice(0, start) + snippet + current.slice(end));
      requestAnimationFrame(() => {
        textarea?.focus();
        const position = start + snippet.length;
        textarea?.setSelectionRange(position, position);
      });
      toast.success(t('docs.imageInserted'));
    } catch (err) {
      setUploadError(err.message || t('docs.uploadError'));
      toast.error(err.message || t('docs.uploadError'));
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    if (saving) return;

    const title = form.title.trim();
    if (!title) {
      setFormError(t('docs.titleRequired'));
      return;
    }

    const slug = slugify(form.slug) || slugify(title);
    if (!slug) {
      setFormError(t('docs.slugRequired'));
      return;
    }

    const payload = {
      title,
      slug,
      parentId: form.parentId || null,
      group: Boolean(form.group),
      order: Number(form.order) || 0,
      description: form.description.trim(),
      content: form.content,
      published: Boolean(form.published),
    };

    if (form.pathOverride && form.path.trim()) {
      payload.path = normalizePath(form.path);
    }

    if (editor?.mode === 'edit' && original) {
      if (slug === (original.slug || '')) delete payload.slug;
      if (!form.pathOverride) delete payload.path;
    }

    setSaving(true);
    setFormError('');
    try {
      if (editor.mode === 'edit') {
        const saved = await api.updateDoc(original.id, payload);
        const savedId = toId(saved?.id ?? saved?._id) || original.id;
        if (payload.parentId) {
          setExpanded((current) => new Set(current).add(payload.parentId));
        }
        setExpanded((current) => new Set(current).add(savedId));
        toast.success(t('docs.updated'));
      } else {
        const saved = await api.createDoc(payload);
        const savedId = toId(saved?.id ?? saved?._id);
        if (payload.parentId) {
          setExpanded((current) => new Set(current).add(payload.parentId));
        }
        if (savedId) {
          setExpanded((current) => new Set(current).add(savedId));
        }
        toast.success(payload.group ? t('docs.groupCreated') : t('docs.pageCreated'));
      }
      setEditor(null);
      setOriginal(null);
      await load();
    } catch (err) {
      setFormError(err.message || t('docs.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleMove(node, direction) {
    if (movingId) return;
    const siblings = tree.get(node.parentId || ROOT_KEY) || [];
    const index = siblings.findIndex((item) => item.id === node.id);
    const target = siblings[index + (direction === 'up' ? -1 : 1)];
    if (index < 0 || !target) return;

    const desired = siblings.filter((item) => item.id !== node.id);
    desired.splice(index + (direction === 'up' ? -1 : 1), 0, node);

    const changes = desired
      .map((item, position) => ({ id: item.id, order: position + 1 }))
      .filter((change) => {
        const sibling = siblings.find((item) => item.id === change.id);
        return Number(sibling?.order ?? 0) !== change.order;
      });

    setMovingId(node.id);
    try {
      for (const change of changes) {
        await api.updateDoc(change.id, { order: change.order });
      }
      await load();
    } catch (err) {
      toast.error(err.message || t('docs.moveError'));
      await load();
    } finally {
      setMovingId(null);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await api.deleteDoc(deleting.id);
      toast.success(t('docs.deleted'));
      setExpanded((current) => {
        const next = new Set(current);
        next.delete(deleting.id);
        return next;
      });
      setDeleting(null);
      await load();
    } catch (err) {
      setDeleteError(err.message || t('docs.deleteError'));
    } finally {
      setDeleteBusy(false);
    }
  }

  const deleteDescendantCount = deleting ? collectDescendants(nodes, deleting.id).size : 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>{t('docs.title')}</h2>
          <p>{t('docs.subtitle')}</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-ghost" onClick={() => openCreate(null, false)}>
            <Icon name="plus" /> {t('docs.addRootPage')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => openCreate(null, true)}>
            <Icon name="plus" /> {t('docs.addRootGroup')}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h3 className="panel-title">{t('docs.title')}</h3>
            <p className="panel-desc">
              {t('docs.panelDesc', {
                groups: groupCount,
                pages: pageCount,
                total: nodes.length,
              })}
            </p>
          </div>
          <div className="page-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={expandAll}>
              {t('docs.expandAll')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={collapseAll}>
              {t('docs.collapseAll')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
              {t('common.reload')}
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="empty-state">
            <span className="spinner" aria-hidden="true" />
            <p>{t('docs.loading')}</p>
          </div>
        ) : nodes.length === 0 ? (
          <div className="empty-state">
            <p>{t('docs.empty')}</p>
            <div className="page-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => openCreate(null, false)}
              >
                {t('docs.addRootPage')}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => openCreate(null, true)}
              >
                {t('docs.addRootGroup')}
              </button>
            </div>
          </div>
        ) : (
          <div className="docs-tree">
            {roots.map((node, index) => (
              <DocRow
                key={node.id}
                node={node}
                depth={0}
                tree={tree}
                expanded={expanded}
                first={index === 0}
                last={index === roots.length - 1}
                movingId={movingId}
                onToggle={toggleNode}
                onAddChild={(parent) => openCreate(parent, false)}
                onEdit={openEdit}
                onDelete={(target) => {
                  setDeleteError('');
                  setDeleting(target);
                }}
                onMove={handleMove}
              />
            ))}
          </div>
        )}
      </div>

      {editor && (
        <Modal
          full
          title={
            editor.mode === 'edit'
              ? t('docs.modalEdit')
              : form.group
                ? t('docs.modalAddGroup')
                : t('docs.modalAddPage')
          }
          onClose={closeEditor}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={closeEditor} disabled={saving}>
                {t('common.cancel')}
              </button>
              <button type="submit" form="docs-form" className="btn btn-primary" disabled={saving}>
                {saving
                  ? t('common.saving')
                  : editor.mode === 'edit'
                    ? t('docs.saveChanges')
                    : t('docs.create')}
              </button>
            </>
          }
        >
          <form id="docs-form" className="form-stack docs-editor" onSubmit={handleSave}>
            {formError && <div className="alert alert-error">{formError}</div>}

            <label className="field">
              <span>
                {t('docs.fieldTitle')} <em className="required">*</em>
              </span>
              <input
                type="text"
                value={form.title}
                onChange={handleTitleChange}
                placeholder={t('docs.titlePlaceholder')}
                autoFocus
                required
              />
            </label>

            <div className="form-row">
              <label className="field">
                <span>{t('docs.fieldSlug')}</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(event) => update('slug', event.target.value)}
                  placeholder={t('docs.slugPlaceholder')}
                />
                <small className="field-hint">{t('docs.slugHint')}</small>
              </label>

              <label className="field field-narrow">
                <span>{t('docs.fieldOrder')}</span>
                <input
                  type="number"
                  value={form.order}
                  onChange={(event) => update('order', event.target.value)}
                />
              </label>
            </div>

            <div className="form-row">
              <label className="field">
                <span>{t('docs.fieldParent')}</span>
                <select
                  value={form.parentId}
                  onChange={(event) => update('parentId', event.target.value)}
                >
                  <option value="">{t('docs.parentRoot')}</option>
                  {parentOptions.map(({ node, depth }) => (
                    <option key={node.id} value={node.id}>
                      {`${'— '.repeat(depth)}${node.title}${
                        node.group ? t('docs.parentGroupSuffix') : ''
                      }`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>{t('docs.fieldType')}</span>
                <select
                  value={form.group ? 'group' : 'page'}
                  onChange={(event) => update('group', event.target.value === 'group')}
                >
                  <option value="page">{t('docs.typePage')}</option>
                  <option value="group">{t('docs.typeGroup')}</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>{t('docs.fieldPath')}</span>
              <input
                type="text"
                value={form.path}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((current) => ({
                    ...current,
                    path: value,
                    pathOverride: value.trim().length > 0,
                  }));
                }}
                placeholder={previewPath}
              />
              <small className="field-hint">
                {t('docs.pathHint')} <code className="path-preview">{previewPath}</code>
                {editor.mode === 'edit' ? t('docs.pathHintEdit') : ''}
              </small>
            </label>

            <label className="field">
              <span>{t('docs.fieldDescription')}</span>
              <textarea
                rows={2}
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
                placeholder={t('docs.descriptionPlaceholder')}
              />
            </label>

            <div className="field docs-content-field">
              <div className="content-field-head">
                <span>{t('docs.fieldContent')}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Icon name="upload" size={14} />
                  {uploading ? t('docs.uploadingImage') : t('docs.insertImage')}
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  className="visually-hidden"
                  onChange={handleImageFile}
                />
              </div>
              <textarea
                ref={contentInputRef}
                className="content-textarea"
                rows={12}
                value={form.content}
                onChange={(event) => update('content', event.target.value)}
                placeholder={t('docs.contentPlaceholder')}
              />
              {uploadError && <span className="field-error">{uploadError}</span>}
              {contentImages.length > 0 && (
                <div className="content-image-strip">
                  {contentImages.map((src) => (
                    <a key={src} href={src} target="_blank" rel="noreferrer" title={src}>
                      <img src={src} alt="" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
              <small className="field-hint">
                {form.group ? t('docs.groupHint') : t('docs.pageHint')}
              </small>
            </div>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(event) => update('published', event.target.checked)}
              />
              {t('docs.published')}
            </label>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title={t('docs.deleteTitle')}
          message={`${t('docs.deleteMessage', { title: deleting.title })}${
            deleteDescendantCount > 0
              ? t('docs.deleteChildren', { count: deleteDescendantCount })
              : ''
          }${t('docs.deleteIrreversible')}`}
          busy={deleteBusy}
          error={deleteError}
          onCancel={() => {
            if (!deleteBusy) setDeleting(null);
          }}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
