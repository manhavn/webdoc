import { useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import {
  buildAppearancePayload,
  createDefaultAppearance,
  isHexColor,
  normalizeAppearance,
  toColorInputValue,
} from '../lib/appearance';
import { buildTree, flattenTree, normalizeNode, ROOT_KEY } from '../lib/docsTree';
import { useI18n } from '../i18n/I18nContext';
import Icon from '../components/Icons';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

const TABS = [
  { id: 'theme', labelKey: 'appearance.tabTheme' },
  { id: 'header', labelKey: 'appearance.tabHeader' },
  { id: 'footer', labelKey: 'appearance.tabFooter' },
  { id: 'navigation', labelKey: 'appearance.tabNavigation' },
  { id: 'cookie', labelKey: 'appearance.tabCookie' },
];

const COLOR_FIELDS = [
  { path: 'colors.primary', labelKey: 'appearance.colorPrimary' },
  { path: 'colors.primaryDark', labelKey: 'appearance.colorPrimaryDark' },
  { path: 'colors.accent', labelKey: 'appearance.colorAccent' },
  { path: 'colors.background', labelKey: 'appearance.colorBackground' },
  { path: 'colors.surface', labelKey: 'appearance.colorSurface' },
  { path: 'colors.text', labelKey: 'appearance.colorText' },
  { path: 'colors.muted', labelKey: 'appearance.colorMuted' },
  { path: 'colors.border', labelKey: 'appearance.colorBorder' },
  { path: 'colors.headerBackground', labelKey: 'appearance.colorHeaderBackground' },
  { path: 'colors.headerText', labelKey: 'appearance.colorHeaderText' },
  { path: 'colors.footerBackground', labelKey: 'appearance.colorFooterBackground' },
  { path: 'colors.footerText', labelKey: 'appearance.colorFooterText' },
];

const OPTIONAL_COLOR_FIELDS = [
  { path: 'header.background', labelKey: 'appearance.headerOverrideBackground', optional: true },
  { path: 'header.text', labelKey: 'appearance.headerOverrideText', optional: true },
  { path: 'footer.background', labelKey: 'appearance.footerOverrideBackground', optional: true },
  { path: 'footer.text', labelKey: 'appearance.footerOverrideText', optional: true },
];

const ALL_COLOR_FIELDS = [...COLOR_FIELDS, ...OPTIONAL_COLOR_FIELDS];

function getAtPath(source, path) {
  return path
    .split('.')
    .reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), source);
}

function setAtPath(source, path, value) {
  const [head, ...rest] = path.split('.');
  if (rest.length === 0) return { ...source, [head]: value };
  const child = source[head] && typeof source[head] === 'object' ? source[head] : {};
  return { ...source, [head]: setAtPath(child, rest.join('.'), value) };
}

function tabForColorPath(path) {
  if (path.startsWith('header.')) return 'header';
  if (path.startsWith('footer.')) return 'footer';
  return 'theme';
}

function ColorField({ labelKey, value, onChange, optional = false }) {
  const { t } = useI18n();
  const invalid = optional ? value.trim() !== '' && !isHexColor(value) : !isHexColor(value);

  return (
    <div className="field color-field">
      <span>{t(labelKey)}</span>
      <div className="color-input-row">
        <input
          type="color"
          className="color-swatch"
          value={toColorInputValue(value)}
          aria-label={t(labelKey)}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          type="text"
          className="color-hex"
          value={value}
          placeholder={optional ? t('appearance.inherit') : '#000000'}
          aria-label={t(labelKey)}
          aria-invalid={invalid || undefined}
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
        />
        {optional && value ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onChange('')}
          >
            {t('appearance.inherit')}
          </button>
        ) : null}
      </div>
      {invalid && <span className="field-error">{t('appearance.invalidColor')}</span>}
    </div>
  );
}

function Toggle({ labelKey, hintKey, checked, onChange }) {
  const { t } = useI18n();
  return (
    <label className="toggle-field">
      <span className="switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="switch-track" aria-hidden="true" />
      </span>
      <span className="toggle-text">
        <strong>{t(labelKey)}</strong>
        {hintKey ? <small>{t(hintKey)}</small> : null}
      </span>
    </label>
  );
}

function BackgroundImageField({ value, onChange }) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const data = await api.upload(file);
      const url = data?.url || '';
      if (!url) throw new Error(t('site.uploadError'));
      onChange(url);
    } catch (err) {
      setError(err.message || t('site.uploadError'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="image-field">
      <div className="image-field-preview">
        {value ? <img src={value} alt={t('appearance.backgroundImage')} /> : <Icon name="upload" size={20} />}
      </div>
      <div className="image-field-body">
        <span className="image-field-label">{t('appearance.backgroundImage')}</span>
        <input
          type="text"
          value={value}
          placeholder={t('site.imageUrlPlaceholder')}
          onChange={(event) => onChange(event.target.value)}
        />
        <small>{t('appearance.backgroundImageHint')}</small>
        {error && <span className="field-error">{error}</span>}
      </div>
      <div className="image-field-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? t('site.uploading') : t('site.upload')}
        </button>
        {value ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange('')}>
            {t('site.remove')}
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className="sr-only"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}

function LabelInputs({ item, labelsKey, locales, enKey, viKey, onChange }) {
  const labels = item?.labels || item?.[labelsKey] || {};
  const fields = locales.length
    ? locales
    : [
        { code: 'en', name: 'English' },
        { code: 'vi', name: 'Tiếng Việt' },
      ];
  return (
    <div className="form-grid-3">
      {fields.map((locale) => {
        const code = locale.code;
        const value =
          (labels && typeof labels[code] === 'string' && labels[code]) ||
          (code === 'en' ? item?.[enKey] || '' : code === 'vi' ? item?.[viKey] || '' : '');
        return (
          <label className="field" key={code}>
            <span>{locale.name || code}</span>
            <input
              type="text"
              value={value}
              onChange={(event) => onChange(code, event.target.value)}
            />
          </label>
        );
      })}
    </div>
  );
}

function updateNavAt(items, path, update) {
  const [head, ...rest] = path;
  return items.map((item, index) => {
    if (index !== head) return item;
    if (!rest.length) return update(item);
    return { ...item, links: updateNavAt(item.links || [], rest, update) };
  });
}

function removeNavAt(items, path) {
  const [head, ...rest] = path;
  if (!rest.length) return items.filter((_, index) => index !== head);
  return items.map((item, index) =>
    index === head
      ? { ...item, links: removeNavAt(item.links || [], rest) }
      : item,
  );
}

function moveNavAt(items, path, delta) {
  const [head, ...rest] = path;
  if (rest.length) {
    return items.map((item, index) =>
      index === head
        ? { ...item, links: moveNavAt(item.links || [], rest, delta) }
        : item,
    );
  }
  const target = head + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[head], next[target]] = [next[target], next[head]];
  return next;
}

function collectNavHrefs(items, out = new Set()) {
  (Array.isArray(items) ? items : []).forEach((item) => {
    const href = String(item?.href || '').trim();
    if (href) out.add(href);
    collectNavHrefs(item?.links, out);
  });
  return out;
}

function docNavHref(doc) {
  return String(doc?.path || '').trim() || '/';
}

function docLinkFields(doc, localeCodes) {
  const title = String(doc.title || doc.path || '').trim();
  return {
    label: title,
    labelVi: title,
    labels: Object.fromEntries(localeCodes.map((code) => [code, title])),
    href: docNavHref(doc),
  };
}

function activeLocaleCodes(locales) {
  return (locales.length ? locales : [{ code: 'en' }, { code: 'vi' }]).map(
    (locale) => locale.code,
  );
}

function moveArrayItem(items, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function cloneNavNodes(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    labels: { ...(item?.labels || {}) },
    links: cloneNavNodes(item?.links),
  }));
}

function indexNavNodes(items, map = new Map()) {
  (Array.isArray(items) ? items : []).forEach((item) => {
    const href = String(item?.href || '').trim();
    if (href && !map.has(href)) map.set(href, item);
    indexNavNodes(item?.links, map);
  });
  return map;
}

function NavNodeEditor({
  node,
  path,
  depth,
  count,
  t,
  locales,
  onLabel,
  onField,
  onAddChild,
  onRemove,
  onMove,
}) {
  const index = path[path.length - 1];
  const links = Array.isArray(node.links) ? node.links : [];
  return (
    <div className={`editor-item${depth > 0 ? ' editor-item-nested' : ''}`}>
      <div className="editor-item-head">
        <span className="editor-item-title">
          {depth === 0
            ? t('appearance.navItemLabel', { index: index + 1 })
            : t('appearance.navChildLabel', { index: index + 1 })}
        </span>
        <div className="editor-order-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title={t('appearance.moveUp')}
            aria-label={t('appearance.moveUp')}
            disabled={index === 0}
            onClick={() => onMove(path, -1)}
          >
            <Icon name="up" size={14} />
            {t('appearance.moveUp')}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title={t('appearance.moveDown')}
            aria-label={t('appearance.moveDown')}
            disabled={index === count - 1}
            onClick={() => onMove(path, 1)}
          >
            <Icon name="down" size={14} />
            {t('appearance.moveDown')}
          </button>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onRemove(path)}
        >
          <Icon name="trash" size={14} />
          {t('common.delete')}
        </button>
      </div>

      <div className="form-stack">
        <LabelInputs
          item={node}
          labelsKey="labels"
          locales={locales}
          enKey="label"
          viKey="labelVi"
          onChange={(code, value) => onLabel(path, code, value)}
        />
        <label className="field">
          <span>{t('appearance.navHref')}</span>
          <input
            type="text"
            value={node.href || ''}
            placeholder={t('appearance.urlPlaceholder')}
            onChange={(event) => onField(path, 'href', event.target.value)}
            spellCheck={false}
          />
        </label>
      </div>

      <div className="nav-children">
        <span className="editor-item-title">{t('appearance.navChildren')}</span>
        {links.map((child, childIndex) => (
          <NavNodeEditor
            key={childIndex}
            node={child}
            path={[...path, childIndex]}
            depth={depth + 1}
            count={links.length}
            t={t}
            locales={locales}
            onLabel={onLabel}
            onField={onField}
            onAddChild={onAddChild}
            onRemove={onRemove}
            onMove={onMove}
          />
        ))}
        <div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onAddChild(path)}
          >
            <Icon name="plus" size={15} />
            {t('appearance.addNavChild')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Appearance() {
  const { t, locales } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState(() => createDefaultAppearance());
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    TABS.some((t) => t.id === tabFromUrl) ? tabFromUrl : 'theme'
  );

  useEffect(() => {
    if (tabFromUrl && TABS.some((t) => t.id === tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  function handleTabChange(id) {
    setActiveTab(id);
    setSearchParams(id === 'theme' ? {} : { tab: id }, { replace: true });
  }
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState('navigation');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [pickerDocs, setPickerDocs] = useState([]);
  const [pickerSelected, setPickerSelected] = useState(() => new Set());
  const [pickerExpanded, setPickerExpanded] = useState(() => new Set());

  const pickerTree = useMemo(() => buildTree(pickerDocs), [pickerDocs]);
  const pickerRows = useMemo(() => {
    const rows = [];
    const walk = (key, depth) => {
      (pickerTree.get(key) || []).forEach((doc) => {
        rows.push({ doc, depth });
        if (pickerExpanded.has(doc.id)) walk(doc.id, depth + 1);
      });
    };
    walk(ROOT_KEY, 0);
    return rows;
  }, [pickerTree, pickerExpanded]);
  const pickerExistingHrefs = useMemo(
    () =>
      collectNavHrefs(
        pickerTarget === 'footerLinks' ? form.footer.links : form.navigation,
      ),
    [pickerTarget, form.footer.links, form.navigation],
  );

  async function load() {
    setLoading(true);
    setLoadFailed(false);
    setError('');
    try {
      setForm(normalizeAppearance(await api.getAppearance()));
    } catch (err) {
      setLoadFailed(true);
      setError(err.message || t('appearance.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(path, value) {
    setForm((current) => setAtPath(current, path, value));
  }

  function resetTheme() {
    const defaults = createDefaultAppearance();
    setForm((current) => ({
      ...current,
      colors: defaults.colors,
      fonts: defaults.fonts,
      background: defaults.background,
    }));
  }

  function toggleThemeOption(option) {
    setForm((current) => {
      const selected = current.theme.options.includes(option)
      let options = selected
        ? current.theme.options.filter((value) => value !== option)
        : [...current.theme.options, option]
      options = ['system', 'light', 'dark'].filter((value) => options.includes(value))
      if (options.length === 0) options = [option]
      const nextDefault = options.includes(current.theme.default)
        ? current.theme.default
        : options[0]
      return {
        ...current,
        theme: { default: nextDefault, options },
      }
    })
  }

  function addFooterLink() {
    setForm((current) => ({
      ...current,
      footer: {
        ...current.footer,
        links: [...current.footer.links, { label: '', labelVi: '', href: '' }],
      },
    }));
  }

  function updateFooterLink(index, field, value) {
    setForm((current) => ({
      ...current,
      footer: {
        ...current.footer,
        links: current.footer.links.map((link, linkIndex) =>
          linkIndex === index ? { ...link, [field]: value } : link,
        ),
      },
    }));
  }

  function removeFooterLink(index) {
    setForm((current) => ({
      ...current,
      footer: {
        ...current.footer,
        links: current.footer.links.filter((_, linkIndex) => linkIndex !== index),
      },
    }));
  }

  function moveFooterLink(index, delta) {
    setForm((current) => ({
      ...current,
      footer: {
        ...current.footer,
        links: moveArrayItem(current.footer.links, index, delta),
      },
    }));
  }

  function moveFooterProduct(index, delta) {
    setForm((current) => ({
      ...current,
      footer: {
        ...current.footer,
        products: moveArrayItem(current.footer.products, index, delta),
      },
    }));
  }

  function addFooterProduct() {
    setForm((current) => ({
      ...current,
      footer: {
        ...current.footer,
        products: [...current.footer.products, { label: '', labelVi: '', href: '' }],
      },
    }));
  }

  function updateFooterProduct(index, field, value) {
    setForm((current) => ({
      ...current,
      footer: {
        ...current.footer,
        products: current.footer.products.map((link, linkIndex) =>
          linkIndex === index ? { ...link, [field]: value } : link,
        ),
      },
    }));
  }

  function removeFooterProduct(index) {
    setForm((current) => ({
      ...current,
      footer: {
        ...current.footer,
        products: current.footer.products.filter((_, linkIndex) => linkIndex !== index),
      },
    }));
  }

  function updateFooterLinkLabel(index, code, value) {
    setForm((current) => ({
      ...current,
      footer: {
        ...current.footer,
        links: current.footer.links.map((link, linkIndex) =>
          linkIndex === index
            ? {
                ...link,
                labels: { ...(link.labels || {}), [code]: value },
                ...(code === 'en' ? { label: value } : {}),
                ...(code === 'vi' ? { labelVi: value } : {}),
              }
            : link,
        ),
      },
    }));
  }

  function updateFooterProductLabel(index, code, value) {
    setForm((current) => ({
      ...current,
      footer: {
        ...current.footer,
        products: current.footer.products.map((product, productIndex) =>
          productIndex === index
            ? {
                ...product,
                labels: { ...(product.labels || {}), [code]: value },
                ...(code === 'en' ? { label: value } : {}),
                ...(code === 'vi' ? { labelVi: value } : {}),
              }
            : product,
        ),
      },
    }));
  }

  function updateNavNode(path, field, value) {
    setForm((current) => ({
      ...current,
      navigation: updateNavAt(current.navigation, path, (node) => ({
        ...node,
        [field]: value,
      })),
    }));
  }

  function updateNavNodeLabel(path, code, value) {
    setForm((current) => ({
      ...current,
      navigation: updateNavAt(current.navigation, path, (node) => ({
        ...node,
        labels: { ...(node.labels || {}), [code]: value },
        ...(code === 'en' ? { label: value } : {}),
        ...(code === 'vi' ? { labelVi: value } : {}),
      })),
    }));
  }
  function updateCtaLabel(code, value) {
    setForm((current) => ({
      ...current,
      header: {
        ...current.header,
        ctaLabels: { ...(current.header.ctaLabels || {}), [code]: value },
        ...(code === 'en' ? { ctaLabel: value } : {}),
        ...(code === 'vi' ? { ctaLabelVi: value } : {}),
      },
    }));
  }

  function moveNavNode(path, delta) {
    setForm((current) => ({
      ...current,
      navigation: moveNavAt(current.navigation, path, delta),
    }));
  }

  function addNavItem() {
    setForm((current) => ({
      ...current,
      navigation: [...current.navigation, { label: '', labelVi: '', href: '', links: [] }],
    }));
  }

  function removeNavNode(path) {
    setForm((current) => ({
      ...current,
      navigation: removeNavAt(current.navigation, path),
    }));
  }

  function addNavChild(path) {
    setForm((current) => ({
      ...current,
      navigation: updateNavAt(current.navigation, path, (node) => ({
        ...node,
        links: [
          ...(node.links || []),
          { label: '', labelVi: '', href: '', links: [] },
        ],
      })),
    }));
  }

  async function openContentPicker(target = 'navigation') {
    setPickerTarget(target);
    setPickerOpen(true);
    setPickerSelected(new Set());
    setPickerDocs([]);
    setPickerExpanded(new Set());
    setPickerError('');
    setPickerLoading(true);
    try {
      const data = await api.listDocs();
      const docs = (Array.isArray(data) ? data : data?.items || []).map(normalizeNode);
      const tree = buildTree(docs);
      const expanded = new Set();
      docs.forEach((doc) => {
        if ((tree.get(doc.id) || []).length) expanded.add(doc.id);
      });
      setPickerDocs(docs);
      setPickerExpanded(expanded);
    } catch (err) {
      setPickerError(err.message || t('appearance.navPickerError'));
    } finally {
      setPickerLoading(false);
    }
  }

  function togglePickerNode(id) {
    setPickerExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePickerSelect(id) {
    setPickerSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addSelectedNavItems() {
    const byId = new Map(pickerDocs.map((doc) => [doc.id, doc]));
    const requiredIds = new Set(pickerSelected);

    // Ancestors are required so the menu keeps the content tree hierarchy.
    pickerDocs
      .filter((doc) => pickerSelected.has(doc.id))
      .forEach((doc) => {
        const seen = new Set([doc.id]);
        let parentId = doc.parentId;
        while (parentId && !seen.has(parentId)) {
          seen.add(parentId);
          const parent = byId.get(parentId);
          if (!parent) break;
          requiredIds.add(parent.id);
          parentId = parent.parentId;
        }
      });

    const ordered = flattenTree(pickerTree)
      .map(({ node }) => node)
      .filter((doc) => requiredIds.has(doc.id));
    if (ordered.length === 0) return;

    const localeCodes = activeLocaleCodes(locales);
    const navigation = cloneNavNodes(form.navigation);
    const byHref = indexNavNodes(navigation);
    const itemByDocId = new Map();
    const newItems = [];

    ordered.forEach((doc) => {
      const href = docNavHref(doc);
      const existing = byHref.get(href);
      if (existing) {
        itemByDocId.set(doc.id, existing);
        return;
      }

      const item = {
        ...docLinkFields(doc, localeCodes),
        links: [],
      };
      byHref.set(href, item);
      itemByDocId.set(doc.id, item);
      newItems.push(item);

      let parentId = doc.parentId;
      let parentItem = null;
      const seen = new Set([doc.id]);
      while (parentId && !seen.has(parentId)) {
        seen.add(parentId);
        const known = itemByDocId.get(parentId);
        if (known) {
          parentItem = known;
          break;
        }
        const parent = byId.get(parentId);
        if (!parent) break;
        parentId = parent.parentId;
      }

      if (parentItem) {
        if (!Array.isArray(parentItem.links)) parentItem.links = [];
        parentItem.links.push(item);
      } else {
        navigation.push(item);
      }
    });

    if (newItems.length === 0) {
      setPickerOpen(false);
      return;
    }

    setForm((current) => ({ ...current, navigation }));
    setPickerOpen(false);
    toast.success(t('appearance.navPickerAdded', { count: newItems.length }));
  }

  function addSelectedFooterLinks() {
    const taken = collectNavHrefs(form.footer.links);
    const chosen = flattenTree(pickerTree)
      .map(({ node }) => node)
      .filter((doc) => pickerSelected.has(doc.id) && !taken.has(docNavHref(doc)));
    if (chosen.length === 0) {
      setPickerOpen(false);
      return;
    }

    const localeCodes = activeLocaleCodes(locales);
    const links = chosen.map((doc) => docLinkFields(doc, localeCodes));
    setForm((current) => ({
      ...current,
      footer: {
        ...current.footer,
        links: [...current.footer.links, ...links],
      },
    }));
    setPickerOpen(false);
    toast.success(t('appearance.footerLinkPickerAdded', { count: links.length }));
  }

  function submitPickedItems() {
    if (pickerTarget === 'footerLinks') addSelectedFooterLinks();
    else addSelectedNavItems();
  }

  function invalidColorField() {
    return ALL_COLOR_FIELDS.find((field) => {
      const value = getAtPath(form, field.path);
      if (typeof value !== 'string') return true;
      if (field.optional) return value.trim() !== '' && !isHexColor(value);
      return !isHexColor(value);
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const invalidField = invalidColorField();
    if (invalidField) {
      setActiveTab(tabForColorPath(invalidField.path));
      setError(t('appearance.invalidColor'));
      return;
    }


    setSaving(true);
    try {
      const payload = buildAppearancePayload(form);
      await api.updateAppearance(payload);
      setForm(normalizeAppearance(payload));
      toast.success(t('appearance.saved'));
    } catch (err) {
      setError(err.message || t('appearance.saveError'));
    } finally {
      setSaving(false);
    }
  }

  function renderTheme() {
    return (
      <div className="appearance-stack">
        <section className="panel form-stack">
          <h3 className="panel-title">{t('appearance.themeMode')}</h3>
          <p className="panel-desc">{t('appearance.themeModeDesc')}</p>
          <label className="field">
            <span>{t('appearance.themeDefault')}</span>
            <select
              value={form.theme.default}
              onChange={(event) => update('theme.default', event.target.value)}
            >
              {form.theme.options.map((option) => (
                <option key={option} value={option}>
                  {t(`theme.${option}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="form-stack">
            <span className="field-label">{t('appearance.themeOptions')}</span>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.theme.options.includes('system')}
                onChange={() => toggleThemeOption('system')}
              />
              <span>{t('theme.system')}</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.theme.options.includes('light')}
                onChange={() => toggleThemeOption('light')}
              />
              <span>{t('theme.light')}</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.theme.options.includes('dark')}
                onChange={() => toggleThemeOption('dark')}
              />
              <span>{t('theme.dark')}</span>
            </label>
            <span className="field-hint">{t('appearance.themeOptionsHint')}</span>
          </div>
        </section>
        <section className="panel form-stack">
          <div className="panel-title-row">
            <div>
              <h3 className="panel-title">{t('appearance.themeColors')}</h3>
              <p className="panel-desc">{t('appearance.themeColorsDesc')}</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetTheme}>
              <Icon name="refresh" size={15} />
              {t('appearance.resetTheme')}
            </button>
          </div>
          <div className="color-grid">
            {COLOR_FIELDS.map((field) => (
              <ColorField
                key={field.path}
                labelKey={field.labelKey}
                value={getAtPath(form, field.path)}
                onChange={(value) => update(field.path, value)}
              />
            ))}
          </div>
        </section>

        <section className="panel form-stack">
          <h3 className="panel-title">{t('appearance.themeFonts')}</h3>
          <p className="panel-desc">{t('appearance.themeFontsDesc')}</p>
          <div className="settings-grid">
            <label className="field">
              <span>{t('appearance.fontBody')}</span>
              <input
                type="text"
                value={form.fonts.body}
                onChange={(event) => update('fonts.body', event.target.value)}
                spellCheck={false}
              />
            </label>
            <label className="field">
              <span>{t('appearance.fontHeading')}</span>
              <input
                type="text"
                value={form.fonts.heading}
                onChange={(event) => update('fonts.heading', event.target.value)}
                spellCheck={false}
              />
            </label>
          </div>
          <div className="settings-grid">
            <label className="field">
              <span>{t('appearance.baseSize')}</span>
              <input
                type="text"
                value={form.fonts.baseSize}
                onChange={(event) => update('fonts.baseSize', event.target.value)}
                spellCheck={false}
              />
              <small className="field-hint">{t('appearance.baseSizeHint')}</small>
            </label>
            <label className="field">
              <span>{t('appearance.googleFontsUrl')}</span>
              <input
                type="url"
                value={form.fonts.googleFontsUrl}
                placeholder={t('appearance.urlPlaceholder')}
                onChange={(event) => update('fonts.googleFontsUrl', event.target.value)}
                spellCheck={false}
              />
              <small className="field-hint">{t('appearance.googleFontsUrlHint')}</small>
            </label>
          </div>
        </section>

        <section className="panel form-stack">
          <h3 className="panel-title">{t('appearance.themeBackground')}</h3>
          <p className="panel-desc">{t('appearance.themeBackgroundDesc')}</p>
          <BackgroundImageField
            value={form.background.image}
            onChange={(value) => update('background.image', value)}
          />
          <div className="settings-grid">
            <ColorField
              labelKey="appearance.backgroundColor"
              value={form.background.color}
              onChange={(value) => update('background.color', value)}
            />
            <label className="field">
              <span>{t('appearance.overlay')}</span>
              <div className="range-row">
                <input
                  type="range"
                  className="range-input"
                  min="0"
                  max="1"
                  step="0.05"
                  value={form.background.overlay}
                  onChange={(event) => update('background.overlay', Number(event.target.value))}
                />
                <span className="range-value">{form.background.overlay.toFixed(2)}</span>
              </div>
              <small className="field-hint">{t('appearance.overlayHint')}</small>
            </label>
          </div>
          <Toggle
            labelKey="appearance.fixed"
            hintKey="appearance.fixedHint"
            checked={form.background.fixed}
            onChange={(checked) => update('background.fixed', checked)}
          />
        </section>
      </div>
    );
  }

  function renderHeader() {
    return (
      <div className="appearance-stack">
        <section className="panel form-stack">
          <h3 className="panel-title">{t('appearance.headerTitle')}</h3>
          <p className="panel-desc">{t('appearance.headerDesc')}</p>
          <div className="toggle-grid">
            <Toggle
              labelKey="appearance.headerShow"
              checked={form.header.show}
              onChange={(checked) => update('header.show', checked)}
            />
            <Toggle
              labelKey="appearance.headerSticky"
              checked={form.header.sticky}
              onChange={(checked) => update('header.sticky', checked)}
            />
            <Toggle
              labelKey="appearance.headerShowSearch"
              checked={form.header.showSearch}
              onChange={(checked) => update('header.showSearch', checked)}
            />
            <Toggle
              labelKey="appearance.headerShowLanguage"
              checked={form.header.showLanguage}
              onChange={(checked) => update('header.showLanguage', checked)}
            />
          </div>
        </section>

        <section className="panel form-stack">
          <h3 className="panel-title">{t('appearance.headerOverrides')}</h3>
          <p className="panel-desc">{t('appearance.headerOverridesHint')}</p>
          <div className="settings-grid">
            {OPTIONAL_COLOR_FIELDS.filter((field) => field.path.startsWith('header.')).map(
              (field) => (
                <ColorField
                  key={field.path}
                  labelKey={field.labelKey}
                  value={getAtPath(form, field.path)}
                  optional
                  onChange={(value) => update(field.path, value)}
                />
              ),
            )}
          </div>
        </section>

        <section className="panel form-stack">
          <h3 className="panel-title">{t('appearance.headerCta')}</h3>
          <p className="panel-desc">{t('appearance.headerCtaDesc')}</p>
          <div className="form-stack">
            <LabelInputs
              item={form.header}
              labelsKey="ctaLabels"
              locales={locales}
              enKey="ctaLabel"
              viKey="ctaLabelVi"
              onChange={updateCtaLabel}
            />
            <label className="field">
              <span>{t('appearance.headerCtaUrl')}</span>
              <input
                type="text"
                value={form.header.ctaUrl}
                placeholder={t('appearance.urlPlaceholder')}
                onChange={(event) => update('header.ctaUrl', event.target.value)}
                spellCheck={false}
              />
            </label>
          </div>
        </section>
      </div>
    );
  }

  function renderFooter() {
    return (
      <div className="appearance-stack">
        <section className="panel form-stack">
          <h3 className="panel-title">{t('appearance.footerTitle')}</h3>
          <p className="panel-desc">{t('appearance.footerDesc')}</p>
          <Toggle
            labelKey="appearance.footerShow"
            checked={form.footer.show}
            onChange={(checked) => update('footer.show', checked)}
          />
        </section>

        <section className="panel form-stack">
          <h3 className="panel-title">{t('appearance.footerOverrides')}</h3>
          <p className="panel-desc">{t('appearance.footerOverridesHint')}</p>
          <div className="settings-grid">
            {OPTIONAL_COLOR_FIELDS.filter((field) => field.path.startsWith('footer.')).map(
              (field) => (
                <ColorField
                  key={field.path}
                  labelKey={field.labelKey}
                  value={getAtPath(form, field.path)}
                  optional
                  onChange={(value) => update(field.path, value)}
                />
              ),
            )}
          </div>
        </section>

        <section className="panel form-stack">
          <h3 className="panel-title">{t('appearance.footerContent')}</h3>
          <label className="field">
            <span>{t('appearance.footerCopyright')}</span>
            <input
              type="text"
              value={form.footer.copyright}
              onChange={(event) => update('footer.copyright', event.target.value)}
            />
          </label>
          <label className="field">
            <span>{t('appearance.footerNote')}</span>
            <textarea
              rows={3}
              value={form.footer.note}
              onChange={(event) => update('footer.note', event.target.value)}
            />
          </label>
        </section>

        <section className="panel form-stack">
          <h3 className="panel-title">{t('appearance.footerLinks')}</h3>
          <p className="panel-desc">{t('appearance.footerLinksHint')}</p>
          {form.footer.links.length === 0 ? (
            <p className="inline-empty">{t('appearance.footerLinksEmpty')}</p>
          ) : null}
          {form.footer.links.map((link, index) => (
            <div className="editor-item" key={`footer-link-${index}`}>
              <div className="editor-item-head">
                <span className="editor-item-title">
                  {t('appearance.footerLinkLabel', { index: index + 1 })}
                </span>
                <div className="editor-order-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    title={t('appearance.moveUp')}
                    aria-label={t('appearance.moveUp')}
                    disabled={index === 0}
                    onClick={() => moveFooterLink(index, -1)}
                  >
                    <Icon name="up" size={14} />
                    {t('appearance.moveUp')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    title={t('appearance.moveDown')}
                    aria-label={t('appearance.moveDown')}
                    disabled={index === form.footer.links.length - 1}
                    onClick={() => moveFooterLink(index, 1)}
                  >
                    <Icon name="down" size={14} />
                    {t('appearance.moveDown')}
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => removeFooterLink(index)}
                >
                  <Icon name="trash" size={14} />
                  {t('common.delete')}
                </button>
              </div>
              <div className="form-stack">
                <LabelInputs
                  item={link}
                  labelsKey="labels"
                  locales={locales}
                  enKey="label"
                  viKey="labelVi"
                  onChange={(code, value) => updateFooterLinkLabel(index, code, value)}
                />
                <label className="field">
                  <span>{t('appearance.linkHref')}</span>
                  <input
                    type="text"
                    value={link.href}
                    placeholder={t('appearance.urlPlaceholder')}
                    onChange={(event) => updateFooterLink(index, 'href', event.target.value)}
                    spellCheck={false}
                  />
                </label>
              </div>
            </div>
          ))}
          <div className="nav-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={addFooterLink}>
              <Icon name="plus" size={15} />
              {t('appearance.addFooterLink')}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => openContentPicker('footerLinks')}
            >
              <Icon name="docs" size={15} />
              {t('appearance.navQuickAdd')}
            </button>
          </div>
        </section>

        <section className="panel form-stack">
          <h3 className="panel-title">{t('appearance.footerProducts')}</h3>
          <p className="panel-desc">{t('appearance.footerProductsHint')}</p>
          {form.footer.products.length === 0 ? (
            <p className="inline-empty">{t('appearance.footerProductsEmpty')}</p>
          ) : null}
          {form.footer.products.map((product, index) => (
            <div className="editor-item" key={`footer-product-${index}`}>
              <div className="editor-item-head">
                <span className="editor-item-title">
                  {t('appearance.footerProductLabel', { index: index + 1 })}
                </span>
                <div className="editor-order-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    title={t('appearance.moveUp')}
                    aria-label={t('appearance.moveUp')}
                    disabled={index === 0}
                    onClick={() => moveFooterProduct(index, -1)}
                  >
                    <Icon name="up" size={14} />
                    {t('appearance.moveUp')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    title={t('appearance.moveDown')}
                    aria-label={t('appearance.moveDown')}
                    disabled={index === form.footer.products.length - 1}
                    onClick={() => moveFooterProduct(index, 1)}
                  >
                    <Icon name="down" size={14} />
                    {t('appearance.moveDown')}
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => removeFooterProduct(index)}
                >
                  <Icon name="trash" size={14} />
                  {t('common.delete')}
                </button>
              </div>
              <div className="form-stack">
                <LabelInputs
                  item={product}
                  labelsKey="labels"
                  locales={locales}
                  enKey="label"
                  viKey="labelVi"
                  onChange={(code, value) => updateFooterProductLabel(index, code, value)}
                />
                <label className="field">
                  <span>{t('appearance.linkHref')}</span>
                  <input
                    type="text"
                    value={product.href}
                    placeholder={t('appearance.urlPlaceholder')}
                    onChange={(event) => updateFooterProduct(index, 'href', event.target.value)}
                    spellCheck={false}
                  />
                </label>
              </div>
            </div>
          ))}
          <div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={addFooterProduct}>
              <Icon name="plus" size={15} />
              {t('appearance.addFooterProduct')}
            </button>
          </div>
        </section>
      </div>
    );
  }

  function renderNavigation() {
    return (
      <div className="appearance-stack">
        <section className="panel form-stack">
          <h3 className="panel-title">{t('appearance.navTitle')}</h3>
          <p className="panel-desc">{t('appearance.navDesc')}</p>
          {form.navigation.length === 0 ? (
            <div className="alert alert-info">{t('appearance.navHint')}</div>
          ) : null}

          {form.navigation.map((item, index) => (
            <NavNodeEditor
              key={`nav-item-${index}`}
              node={item}
              path={[index]}
              depth={0}
              count={form.navigation.length}
              t={t}
              locales={locales}
              onLabel={updateNavNodeLabel}
              onField={updateNavNode}
              onAddChild={addNavChild}
              onRemove={removeNavNode}
              onMove={moveNavNode}
            />
          ))}

          <div className="nav-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={addNavItem}>
              <Icon name="plus" size={15} />
              {t('appearance.addNavItem')}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => openContentPicker('navigation')}
            >
              <Icon name="docs" size={15} />
              {t('appearance.navQuickAdd')}
            </button>
          </div>
        </section>
      </div>
    );
  }
  function renderCookie() {
    const cookie = form.cookie || createDefaultAppearance().cookie;

    return (
      <div className="appearance-stack">
        <section className="panel form-stack">
          <h3 className="panel-title">{t('appearance.cookieTitle')}</h3>
          <p className="panel-desc">{t('appearance.cookieDesc')}</p>
          <Toggle
            labelKey="appearance.cookieEnabled"
            hintKey="appearance.cookieEnabledHint"
            checked={Boolean(cookie.enabled)}
            onChange={(checked) => update('cookie.enabled', checked)}
          />
        </section>

        {!cookie.enabled && (
          <div className="alert alert-info">
            <Icon name="info" size={16} /> {t('appearance.cookieDisabledNotice')}
          </div>
        )}

        <section className="panel form-stack">
          <h3 className="panel-title">{t('appearance.cookieGeneralTitle')}</h3>
          <p className="panel-desc">{t('appearance.cookieGeneralDesc')}</p>
          <label className="field">
            <span>{t('appearance.cookieFieldTitle')}</span>
            <input
              type="text"
              value={cookie.title || ''}
              placeholder={t('cookie.title')}
              onChange={(e) => update('cookie.title', e.target.value)}
            />
          </label>
          <label className="field">
            <span>{t('appearance.cookieFieldDesc')}</span>
            <textarea
              rows={3}
              value={cookie.description || ''}
              placeholder={t('cookie.body')}
              onChange={(e) => update('cookie.description', e.target.value)}
            />
          </label>
          <div className="settings-grid">
            <label className="field">
              <span>{t('appearance.cookiePolicyUrl')}</span>
              <input
                type="text"
                value={cookie.policyUrl || ''}
                placeholder="https://example.com/privacy or /privacy"
                onChange={(e) => update('cookie.policyUrl', e.target.value)}
              />
              <small className="field-hint">{t('appearance.cookiePolicyUrlHint')}</small>
            </label>
            <label className="field">
              <span>{t('appearance.cookiePolicyText')}</span>
              <input
                type="text"
                value={cookie.policyText || ''}
                placeholder="Privacy Policy"
                onChange={(e) => update('cookie.policyText', e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="panel form-stack">
          <h3 className="panel-title">{t('appearance.cookieCategoriesTitle')}</h3>
          <p className="panel-desc">{t('appearance.cookieCategoriesDesc')}</p>

          <div className="editor-item">
            <div className="editor-item-head">
              <span className="editor-item-title">
                {t('appearance.cookieCategoryNecessary')}
              </span>
              <span className="badge badge-muted">{t('appearance.cookieNecessaryAlwaysOn')}</span>
            </div>
            <div className="editor-item-body form-stack">
              <label className="field">
                <span>{t('appearance.cookieCategoryTitle')}</span>
                <input
                  type="text"
                  value={cookie.necessaryTitle || ''}
                  placeholder={t('cookie.necessary')}
                  onChange={(e) => update('cookie.necessaryTitle', e.target.value)}
                />
              </label>
              <label className="field">
                <span>{t('appearance.cookieCategoryDesc')}</span>
                <input
                  type="text"
                  value={cookie.necessaryDescription || ''}
                  placeholder={t('cookie.necessaryDesc')}
                  onChange={(e) => update('cookie.necessaryDescription', e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="editor-item">
            <div className="editor-item-head">
              <span className="editor-item-title">
                {t('appearance.cookieCategoryAnalytics')}
              </span>
            </div>
            <div className="editor-item-body form-stack">
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <Toggle
                  labelKey="appearance.cookieCategoryEnabled"
                  checked={Boolean(cookie.analyticsEnabled)}
                  onChange={(checked) => update('cookie.analyticsEnabled', checked)}
                />
                {cookie.analyticsEnabled && (
                  <Toggle
                    labelKey="appearance.cookieCategoryDefault"
                    checked={Boolean(cookie.analyticsDefault)}
                    onChange={(checked) => update('cookie.analyticsDefault', checked)}
                  />
                )}
              </div>
              <label className="field">
                <span>{t('appearance.cookieCategoryTitle')}</span>
                <input
                  type="text"
                  value={cookie.analyticsTitle || ''}
                  placeholder={t('cookie.analytics')}
                  onChange={(e) => update('cookie.analyticsTitle', e.target.value)}
                />
              </label>
              <label className="field">
                <span>{t('appearance.cookieCategoryDesc')}</span>
                <input
                  type="text"
                  value={cookie.analyticsDescription || ''}
                  placeholder={t('cookie.analyticsDesc')}
                  onChange={(e) => update('cookie.analyticsDescription', e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="editor-item">
            <div className="editor-item-head">
              <span className="editor-item-title">
                {t('appearance.cookieCategoryMarketing')}
              </span>
            </div>
            <div className="editor-item-body form-stack">
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <Toggle
                  labelKey="appearance.cookieCategoryEnabled"
                  checked={Boolean(cookie.marketingEnabled)}
                  onChange={(checked) => update('cookie.marketingEnabled', checked)}
                />
                {cookie.marketingEnabled && (
                  <Toggle
                    labelKey="appearance.cookieCategoryDefault"
                    checked={Boolean(cookie.marketingDefault)}
                    onChange={(checked) => update('cookie.marketingDefault', checked)}
                  />
                )}
              </div>
              <label className="field">
                <span>{t('appearance.cookieCategoryTitle')}</span>
                <input
                  type="text"
                  value={cookie.marketingTitle || ''}
                  placeholder={t('cookie.marketing')}
                  onChange={(e) => update('cookie.marketingTitle', e.target.value)}
                />
              </label>
              <label className="field">
                <span>{t('appearance.cookieCategoryDesc')}</span>
                <input
                  type="text"
                  value={cookie.marketingDescription || ''}
                  placeholder={t('cookie.marketingDesc')}
                  onChange={(e) => update('cookie.marketingDescription', e.target.value)}
                />
              </label>
            </div>
          </div>
        </section>

        <section className="panel form-stack">
          <h3 className="panel-title">{t('appearance.cookieButtonsTitle')}</h3>
          <p className="panel-desc">{t('appearance.cookieButtonsDesc')}</p>
          <div className="settings-grid">
            <label className="field">
              <span>{t('appearance.cookieBtnAcceptAll')}</span>
              <input
                type="text"
                value={cookie.acceptAllText || ''}
                placeholder={t('cookie.acceptAll')}
                onChange={(e) => update('cookie.acceptAllText', e.target.value)}
              />
            </label>
            <label className="field">
              <span>{t('appearance.cookieBtnOnlyNecessary')}</span>
              <input
                type="text"
                value={cookie.onlyNecessaryText || ''}
                placeholder={t('cookie.onlyNecessary')}
                onChange={(e) => update('cookie.onlyNecessaryText', e.target.value)}
              />
            </label>
            <label className="field">
              <span>{t('appearance.cookieBtnSave')}</span>
              <input
                type="text"
                value={cookie.saveText || ''}
                placeholder={t('cookie.save')}
                onChange={(e) => update('cookie.saveText', e.target.value)}
              />
            </label>
            <label className="field">
              <span>{t('appearance.cookieBtnClose')}</span>
              <input
                type="text"
                value={cookie.closeText || ''}
                placeholder={t('cookie.close')}
                onChange={(e) => update('cookie.closeText', e.target.value)}
              />
            </label>
            <label className="field">
              <span>{t('appearance.cookieBtnFooter')}</span>
              <input
                type="text"
                value={cookie.footerText || ''}
                placeholder={t('footer.cookieSettings')}
                onChange={(e) => update('cookie.footerText', e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="panel form-stack">
          <h3 className="panel-title">{t('appearance.cookiePreviewTitle')}</h3>
          <p className="panel-desc">{t('appearance.cookiePreviewDesc')}</p>
          <div className="cookie-preview-wrapper">
            <div className="cookie-preview-card">
              <h4>{cookie.title?.trim() || t('cookie.title')}</h4>
              <p>{cookie.description?.trim() || t('cookie.body')}</p>
              {cookie.policyUrl?.trim() && (
                <div style={{ marginBottom: 10 }}>
                  <a href={cookie.policyUrl} target="_blank" rel="noreferrer" className="cookie-preview-link">
                    {cookie.policyText?.trim() || 'Privacy Policy'}
                  </a>
                </div>
              )}
              <div className="cookie-preview-rows">
                <div className="cookie-preview-row">
                  <input type="checkbox" checked disabled />
                  <div>
                    <strong>{cookie.necessaryTitle?.trim() || t('cookie.necessary')}</strong>
                    <small>{cookie.necessaryDescription?.trim() || t('cookie.necessaryDesc')}</small>
                  </div>
                </div>
                {cookie.analyticsEnabled && (
                  <div className="cookie-preview-row">
                    <input type="checkbox" checked={Boolean(cookie.analyticsDefault)} readOnly />
                    <div>
                      <strong>{cookie.analyticsTitle?.trim() || t('cookie.analytics')}</strong>
                      <small>{cookie.analyticsDescription?.trim() || t('cookie.analyticsDesc')}</small>
                    </div>
                  </div>
                )}
                {cookie.marketingEnabled && (
                  <div className="cookie-preview-row">
                    <input type="checkbox" checked={Boolean(cookie.marketingDefault)} readOnly />
                    <div>
                      <strong>{cookie.marketingTitle?.trim() || t('cookie.marketing')}</strong>
                      <small>{cookie.marketingDescription?.trim() || t('cookie.marketingDesc')}</small>
                    </div>
                  </div>
                )}
              </div>
              <div className="cookie-preview-actions">
                <button type="button" className="btn btn-ghost btn-sm" disabled>
                  {cookie.onlyNecessaryText?.trim() || t('cookie.onlyNecessary')}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" disabled>
                  {cookie.saveText?.trim() || t('cookie.save')}
                </button>
                <button type="button" className="btn btn-primary btn-sm" disabled>
                  {cookie.acceptAllText?.trim() || t('cookie.acceptAll')}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const panels = {
    theme: renderTheme,
    header: renderHeader,
    footer: renderFooter,
    navigation: renderNavigation,
    cookie: renderCookie,
  };
  const renderActivePanel = panels[activeTab] || renderTheme;
  const pickerIsFooter = pickerTarget === 'footerLinks';
  const pickerTitleKey = pickerIsFooter
    ? 'appearance.footerLinkPickerTitle'
    : 'appearance.navPickerTitle';
  const pickerDescKey = pickerIsFooter
    ? 'appearance.footerLinkPickerDesc'
    : 'appearance.navPickerDesc';
  const pickerExistingKey = pickerIsFooter
    ? 'appearance.footerLinkPickerExisting'
    : 'appearance.navPickerExisting';

  return (
    <>
      <form className="page" onSubmit={handleSubmit}>
      <div className="page-head">
        <div>
          <h2>{t('appearance.title')}</h2>
          <p>{t('appearance.subtitle')}</p>
        </div>
        <div className="page-actions">
          <a className="btn btn-ghost" href="/" target="_blank" rel="noreferrer">
            <Icon name="external" size={16} />
            {t('appearance.preview')}
          </a>
          <button type="button" className="btn btn-ghost" onClick={load} disabled={loading || saving}>
            {t('common.reload')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading || saving || loadFailed}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="appearance-tabs" role="tablist" aria-label={t('appearance.title')}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`appearance-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`appearance-panel-${tab.id}`}
            className={`appearance-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="panel empty-state">{t('appearance.loading')}</div>
      ) : (
        <div
          id={`appearance-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`appearance-tab-${activeTab}`}
        >
          {renderActivePanel()}
        </div>
      )}

      {!loading && (
        <div className="sticky-save">
          <span className="sticky-save-note">
            <Icon name="appearance" size={16} />
            {t('appearance.stickyNote')}
          </span>
          <button type="submit" className="btn btn-primary" disabled={saving || loadFailed}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      )}
      </form>

      {pickerOpen && (
        <Modal
          wide
          title={t(pickerTitleKey)}
          onClose={() => setPickerOpen(false)}
          footer={
            <>
              <span className="nav-picker-count">
                {t('appearance.navPickerSelected', { count: pickerSelected.size })}
              </span>
              <button type="button" className="btn btn-ghost" onClick={() => setPickerOpen(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitPickedItems}
                disabled={pickerLoading || pickerSelected.size === 0}
              >
                {t('appearance.navPickerAdd')}
              </button>
            </>
          }
        >
          <p className="panel-desc">{t(pickerDescKey)}</p>

          {pickerError ? (
            <div className="alert alert-error">{pickerError}</div>
          ) : pickerLoading ? (
            <div className="inline-empty">{t('common.loading')}</div>
          ) : pickerRows.length === 0 ? (
            <div className="alert alert-info">{t('appearance.navPickerEmpty')}</div>
          ) : (
            <div className="nav-picker">
              {pickerRows.map(({ doc, depth }) => {
                const children = pickerTree.get(doc.id) || [];
                const expanded = pickerExpanded.has(doc.id);
                const existing = pickerExistingHrefs.has(docNavHref(doc));
                const title = doc.title || t('docs.noTitle');
                return (
                  <div
                    className="nav-picker-row"
                    key={doc.id}
                    style={{ '--depth': depth }}
                  >
                    {children.length > 0 ? (
                      <button
                        type="button"
                        className="docs-toggle"
                        onClick={() => togglePickerNode(doc.id)}
                        aria-expanded={expanded}
                        aria-label={
                          expanded
                            ? t('appearance.navPickerCollapse', { title })
                            : t('appearance.navPickerExpand', { title })
                        }
                      >
                        <Icon
                          name="down"
                          size={16}
                          className={expanded ? 'docs-caret' : 'docs-caret docs-caret-collapsed'}
                        />
                      </button>
                    ) : (
                      <span className="docs-toggle-spacer" aria-hidden="true" />
                    )}

                    <label className="nav-picker-check">
                      <input
                        type="checkbox"
                        checked={pickerSelected.has(doc.id)}
                        disabled={existing}
                        onChange={() => togglePickerSelect(doc.id)}
                        aria-label={title}
                      />
                    </label>

                    <div className="nav-picker-info">
                      <span className="nav-picker-title">{title}</span>
                      <code>{doc.path || '—'}</code>
                    </div>

                    {doc.group ? (
                      <span className="badge badge-featured">{t('docs.badgeGroup')}</span>
                    ) : null}
                    {!doc.published ? (
                      <span className="badge badge-draft">{t('docs.badgeHidden')}</span>
                    ) : null}
                    {existing ? (
                      <span className="badge badge-muted">
                        {t(pickerExistingKey)}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
