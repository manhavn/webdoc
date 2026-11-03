import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/+$/, '');
const STORAGE_KEY = 'webdoc_lang';
const FALLBACK_LANG = 'en';

const messageCache = new Map();

let activeMessages = {};
let activeDefaultMessages = {};

function readStoredLang() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}
const BUILTIN_MESSAGES = {
  vi: {
    'nav.cmsSettings': 'Cài đặt CMS',
    'nav.tokenExpiryTitle': 'Thời hạn phiên làm việc',
    'nav.tokenExpired': 'đã đăng xuất',
    'nav.tokenExpiredWarning': 'Bạn cần copy những thứ đang làm vào nơi khác và đăng nhập lại.',
    'nav.tokenExpiredToast': 'Phiên đăng nhập đã hết hạn! Bạn cần copy những thứ đang làm vào nơi khác để tránh mất dữ liệu và đăng nhập lại.',
    'nav.refreshTokenBtn': 'Gia hạn token',
    'nav.refreshingToken': 'Đang gia hạn…',
    'nav.refreshTokenSuccess': 'Đã gia hạn phiên đăng nhập thành công.',
    'nav.refreshTokenError': 'Không thể gia hạn phiên đăng nhập.',
    'nav.unitSeconds': 'giây',
    'nav.unitMinutes': 'phút',
    'nav.unitHours': 'giờ',
    'nav.unitDays': 'ngày',
    'cms.title': 'Cài đặt CMS',
    'cms.subtitle': 'Tùy biến thương hiệu, logo, màu sắc và giao diện cho riêng hệ thống quản trị CMS.',
    'cms.save': 'Lưu cấu hình',
    'cms.saving': 'Đang lưu…',
    'cms.saveSuccess': 'Đã lưu cấu hình CMS thành công.',
    'cms.reset': 'Khôi phục mặc định',
    'cms.resetConfirm': 'Bạn có chắc chắn muốn đặt lại toàn bộ cài đặt giao diện CMS về mặc định?',
    'cms.resetSuccess': 'Đã đặt lại cấu hình CMS về mặc định.',
    'cms.tabBrand': 'Thương hiệu & Logo',
    'cms.tabColors': 'Màu sắc giao diện',
    'cms.tabLogin': 'Màn hình đăng nhập',
    'cms.tabSecurity': 'Bảo mật & Phiên làm việc',
    'cms.brandName': 'Tên thương hiệu CMS',
    'cms.brandNameHint': 'Hiển thị trên thanh bên, tiêu đề trang và màn hình đăng nhập.',
    'cms.brandSubname': 'Tiêu đề phụ',
    'cms.brandSubnameHint': 'Dòng mô tả ngắn dưới tên thương hiệu.',
    'cms.logo': 'Logo CMS',
    'cms.logoHint': 'Tải lên ảnh logo (PNG, SVG, WEBP) hoặc dán link ảnh logo.',
    'cms.logoUpload': 'Tải ảnh logo',
    'cms.logoRemove': 'Xóa logo',
    'cms.logoChar': 'Ký tự biểu trưng',
    'cms.logoCharHint': 'Ký tự hiển thị trong khối biểu trưng khi không dùng ảnh logo.',
    'cms.favicon': 'Favicon CMS',
    'cms.faviconHint': 'Biểu tượng tab trình duyệt cho trang quản trị CMS.',
    'cms.faviconUpload': 'Tải favicon',
    'cms.footerText': 'Ghi chú chân trang CMS',
    'cms.footerTextHint': 'Văn bản bản quyền hoặc ghi chú hiển thị ở chân thanh bên và màn hình đăng nhập.',
    'cms.presets': 'Bảng màu doanh nghiệp mẫu',
    'cms.primaryColor': 'Màu chủ đạo (Primary / Accent)',
    'cms.primaryDarkColor': 'Màu chủ đạo khi hover / nhấn',
    'cms.accentDarkColor': 'Màu chủ đạo chế độ Tối (Dark mode)',
    'cms.sidebarBg': 'Màu nền thanh bên (Sidebar)',
    'cms.sidebarText': 'Màu chữ thanh bên',
    'cms.topbarBg': 'Màu nền thanh trên (Topbar)',
    'cms.topbarText': 'Màu chữ thanh trên',
    'cms.loginWelcome': 'Tiêu đề chào mừng trên banner',
    'cms.loginDescription': 'Mô tả chi tiết trên banner',
    'cms.loginCardTitle': 'Tiêu đề thẻ đăng nhập',
    'cms.loginCardSubtitle': 'Phụ đề thẻ đăng nhập',
    'cms.loginPanelBg': 'Màu nền khung đăng nhập (login-panel)',
    'cms.loginPanelBgHint': 'Màu nền hoặc dải màu (gradient) của khung banner bên trái màn hình đăng nhập.',
    'cms.loginPanelBgDefault': 'Mặc định (Teal)',
    'cms.loginPanelPresets': 'Dải màu mẫu login-panel',
    'cms.previewLogin': 'Xem trước màn hình đăng nhập',
    'cms.previewLoginDesc': 'Xem trước khung banner giới thiệu và thẻ đăng nhập với màu nền và thông tin đã chọn.',
    'cms.preview': 'Xem trước trực quan',
    'cms.previewDesc': 'Xem trước thanh bên và thanh trên với màu sắc và logo đã chọn.',
    'cms.tokenLifespanTitle': 'Thời hạn phiên làm việc (Token JWT)',
    'cms.tokenLifespanDesc': 'Thiết lập thời gian duy trì đăng nhập cho quản trị viên. Sau khi hết thời gian này, token sẽ hết hạn và quản trị viên phải đăng nhập lại.',
    'cms.tokenDaysLabel': 'Thời gian sống của token (ngày)',
    'cms.tokenDaysHint': 'Nhập số ngày token có hiệu lực (ví dụ: 30 hoặc 365 ngày). Mặc định là 1 ngày (24 giờ).',
    'cms.tokenDaysCurrentNotice': 'Thời gian hết hạn phiên: {days} ngày ({hours} giờ kể từ lúc đăng nhập).',
    'cms.tokenDaysPresets': 'Gợi ý thời gian:',
    'cms.tokenDaysPreset1': '1 ngày (Mặc định)',
    'cms.tokenDaysPreset7': '7 ngày (1 tuần)',
    'cms.tokenDaysPreset30': '30 ngày (1 tháng)',
    'cms.tokenDaysPreset90': '90 ngày (3 tháng)',
    'cms.tokenDaysPreset180': '180 ngày (6 tháng)',
    'cms.tokenDaysPreset365': '365 ngày (1 năm)',
    'cms.tokenDaysEffectiveNotice': 'Lưu ý: Thay đổi này sẽ áp dụng cho các phiên đăng nhập mới sau khi lưu cấu hình.',
    'cms.daysUnit': 'ngày',
    'cms.userSecretTitle': 'Khóa bí mật người dùng (User Secret Key)',
    'cms.userSecretDesc': 'Mỗi tài khoản lưu một secret key riêng biệt trong cơ sở dữ liệu. Khi đổi secret key, tất cả token đang đăng nhập của tài khoản này sẽ lập tức bị hủy bỏ và phải đăng nhập lại.',
    'cms.userSecretActionTitle': 'Đổi Secret Key & Đăng xuất toàn bộ thiết bị',
    'cms.userSecretActionHint': 'Tạo mới secret key trong database cho tài khoản đang đăng nhập, vô hiệu hóa ngay lập tức mọi phiên làm việc hiện có.',
    'cms.resetSecretBtn': 'Đổi Secret Key (Đăng xuất tất cả)',
    'cms.resettingSecret': 'Đang đổi Secret Key…',
    'cms.resetSecretConfirmTitle': 'Đổi Secret Key và Đăng xuất?',
    'cms.resetSecretConfirmMessage': 'Bạn có chắc chắn muốn đổi Secret Key cho tài khoản đang đăng nhập? Thao tác này sẽ cập nhật khóa bí mật trong cơ sở dữ liệu và ngay lập tức thu hồi toàn bộ token đăng nhập trên tất cả thiết bị. Bạn sẽ cần phải đăng nhập lại.',
    'cms.resetSecretConfirmBtn': 'Đổi Secret Key & Đăng xuất',
    'cms.resetSecretSuccess': 'Đã đổi Secret Key thành công. Toàn bộ phiên đăng nhập đã bị thu hồi, đang chuyển hướng về trang đăng nhập…',
    'site.skipHomepage': 'Bỏ qua trang chủ (truy cập thẳng cây tài liệu)',
    'site.skipHomepageHint': 'Khi bật, người dùng truy cập website sẽ tự động bỏ qua trang chủ và chuyển hướng trực tiếp đến trang đầu tiên trong cây thư mục.',
    'appearance.headerShowNavigation': 'Hiện điều hướng',
    'docs.show': 'Hiển thị trên website',
    'docs.showAria': 'Hiển thị {title} trên website',
    'docs.hide': 'Ẩn trên website',
    'docs.hideAria': 'Ẩn {title} trên website',
    'docs.publishSuccess': 'Đã hiển thị “{title}” trên website.',
    'docs.hideSuccess': 'Đã ẩn “{title}” trên website.',
    'docs.toggleError': 'Không thể thay đổi trạng thái hiển thị.',
    'docs.viewOnSite': 'Xem trên website',
    'docs.viewOnSiteAria': 'Xem “{title}” trên website',
    'docs.autosaveOn': 'Tự động lưu: {s}s',
    'docs.autosaveOff': 'Tự động lưu: Tắt',
    'docs.autosaving': 'Đang tự động lưu…',
    'docs.autosaved': 'Đã tự động lưu thay đổi.',
    'docs.autosaveTooltip': 'Chu kỳ tự động lưu: 30s → Tắt → 5s → 10s → 20s',
    'docs.autosaveIntervalNotice': 'Đã đặt tự động lưu sau {s} giây.',
    'docs.autosaveOffNotice': 'Đã tắt tự động lưu.',
    'docs.ownerTooltip': 'Chủ sở hữu: @{user}',
    'docs.noEditPermission': 'Chỉ chủ bài viết hoặc người trong danh sách user access mới có quyền xem/sửa bài này.',
    'docs.noPublishPermission': 'Bạn không có quyền ẩn/hiện mục này.',
    'docs.noDeletePermission': 'Chỉ chủ sở hữu hoặc chủ nhóm mới có quyền xóa mục này.',
    'docs.userAccessTitle': 'Danh sách User Access (Cấp quyền xem & sửa)',
    'docs.userAccessHintOwner': 'Chọn các người dùng được phép xem nội dung, sửa bài và ẩn/hiện bài viết này trên website:',
    'docs.userAccessHintNonOwner': 'Bài viết này do @{owner} sở hữu. Bạn đang được cấp quyền xem & sửa.',
    'docs.noOtherUsers': 'Chưa có tài khoản nào khác trong hệ thống.',
    'nav.users': 'Tài khoản',
    'users.title': 'Quản lý tài khoản',
    'users.subtitle': 'Tạo tài khoản người dùng và thiết lập phân quyền các mục được phép truy cập.',
    'users.createUser': 'Tạo tài khoản',
    'users.username': 'Tên đăng nhập',
    'users.usernamePlaceholder': 'Nhập tên đăng nhập (ví dụ: editor_john)',
    'users.password': 'Mật khẩu',
    'users.passwordPlaceholder': 'Tối thiểu 6 ký tự',
    'users.role': 'Vai trò',
    'users.roleAdmin': 'Quản trị viên (Toàn quyền)',
    'users.roleEditor': 'Biên tập viên (Theo phân quyền)',
    'users.allowedRoutes': 'Danh sách mục được phép truy cập (Router access)',
    'users.allowedRoutesHint': 'Mặc định tài khoản mới chỉ có quyền truy cập Trang tổng quan, Cây tài liệu, Đổi mật khẩu và tab Bảo mật của Cài đặt CMS. Bạn có thể chọn thêm các mục khác.',
    'users.fullAccess': 'Toàn quyền (Admin)',
    'users.editPermissions': 'Sửa quyền',
    'users.resetPassword': 'Đổi mật khẩu',
    'users.newPasswordOptional': 'Mật khẩu mới (bỏ trống nếu không đổi)',
    'users.deleteConfirmTitle': 'Xóa tài khoản?',
    'users.deleteConfirmMessage': 'Bạn có chắc chắn muốn xóa tài khoản “{username}”? Thao tác này không thể hoàn tác.',
    'users.created': 'Đã tạo tài khoản thành công.',
    'users.updated': 'Đã cập nhật tài khoản thành công.',
    'users.deleted': 'Đã xóa tài khoản thành công.',
    'users.routeOverview': 'Trang tổng quan (Overview)',
    'users.routeDocs': 'Cây tài liệu (Content tree)',
    'users.routeCmsSettings': 'Cài đặt CMS (Bảo mật & Phiên)',
    'users.routeSite': 'Cài đặt website',
    'users.routeAppearance': 'Giao diện website',
    'users.routeHomepage': 'Quản lý trang chủ',
    'users.routeLanguages': 'Đa ngôn ngữ',
    'users.routeBackup': 'Sao lưu & Phục hồi',
    'users.empty': 'Chưa có tài khoản nào.',
  },
  en: {
    'nav.cmsSettings': 'CMS Settings',
    'nav.tokenExpiryTitle': 'Session countdown',
    'nav.tokenExpired': 'Signed out',
    'nav.tokenExpiredWarning': 'You need to copy your ongoing work elsewhere and sign in again.',
    'nav.tokenExpiredToast': 'Session expired! Please copy your ongoing work to avoid losing data and sign in again.',
    'nav.refreshTokenBtn': 'Refresh token',
    'nav.refreshingToken': 'Refreshing…',
    'nav.refreshTokenSuccess': 'Session token refreshed successfully.',
    'nav.refreshTokenError': 'Unable to refresh session token.',
    'nav.unitSeconds': 'seconds',
    'nav.unitMinutes': 'minutes',
    'nav.unitHours': 'hours',
    'nav.unitDays': 'days',
    'cms.title': 'CMS Settings',
    'cms.subtitle': 'Customize branding, logo, colors and interface for the admin CMS.',
    'cms.save': 'Save settings',
    'cms.saving': 'Saving…',
    'cms.saveSuccess': 'CMS settings saved successfully.',
    'cms.reset': 'Reset to defaults',
    'cms.resetConfirm': 'Are you sure you want to reset all CMS appearance settings to defaults?',
    'cms.resetSuccess': 'CMS settings reset to defaults.',
    'cms.tabBrand': 'Branding & Logo',
    'cms.tabColors': 'Colors & Styling',
    'cms.tabLogin': 'Login Screen',
    'cms.tabSecurity': 'Security & Sessions',
    'cms.brandName': 'CMS Brand Name',
    'cms.brandNameHint': 'Displayed in the sidebar, browser title and login page.',
    'cms.brandSubname': 'Subtitle',
    'cms.brandSubnameHint': 'Short subtitle below the brand name.',
    'cms.logo': 'CMS Logo',
    'cms.logoHint': 'Upload a logo image (PNG, SVG, WEBP) or paste an image URL.',
    'cms.logoUpload': 'Upload logo',
    'cms.logoRemove': 'Remove logo',
    'cms.logoChar': 'Logo Mark Character',
    'cms.logoCharHint': 'Character shown in the brand mark box when no logo image is set.',
    'cms.favicon': 'CMS Favicon',
    'cms.faviconHint': 'Browser tab icon for the admin CMS.',
    'cms.faviconUpload': 'Upload favicon',
    'cms.footerText': 'CMS Footer Note',
    'cms.footerTextHint': 'Copyright or custom footnote shown at the bottom of the sidebar and login page.',
    'cms.presets': 'Color Presets',
    'cms.primaryColor': 'Primary / Accent Color',
    'cms.primaryDarkColor': 'Primary Hover / Dark Shade',
    'cms.accentDarkColor': 'Dark Mode Accent Color',
    'cms.sidebarBg': 'Sidebar Background',
    'cms.sidebarText': 'Sidebar Text Color',
    'cms.topbarBg': 'Topbar Background',
    'cms.topbarText': 'Topbar Text Color',
    'cms.loginWelcome': 'Login Banner Heading',
    'cms.loginDescription': 'Login Banner Description',
    'cms.loginCardTitle': 'Login Card Title',
    'cms.loginCardSubtitle': 'Login Card Subtitle',
    'cms.loginPanelBg': 'Login panel background (login-panel)',
    'cms.loginPanelBgHint': 'Background color or gradient for the intro banner on the login screen.',
    'cms.loginPanelBgDefault': 'Default (Teal)',
    'cms.loginPanelPresets': 'Login panel gradient presets',
    'cms.previewLogin': 'Login screen preview',
    'cms.previewLoginDesc': 'Preview the login banner and sign-in card with your chosen background and text.',
    'cms.preview': 'Live Preview',
    'cms.previewDesc': 'Preview of the sidebar and topbar with your chosen logo and colors.',
    'cms.tokenLifespanTitle': 'Session Lifespan (JWT Token)',
    'cms.tokenLifespanDesc': 'Set the duration administrators stay signed in. When this period expires, the token expires and the administrator must sign in again.',
    'cms.tokenDaysLabel': 'Token lifespan (days)',
    'cms.tokenDaysHint': 'Enter the number of days the token remains valid (e.g. 30 or 365 days). Default is 1 day (24 hours).',
    'cms.tokenDaysCurrentNotice': 'Current session expiry: {days} days ({hours} hours from login).',
    'cms.tokenDaysPresets': 'Preset durations:',
    'cms.tokenDaysPreset1': '1 day (Default)',
    'cms.tokenDaysPreset7': '7 days (1 week)',
    'cms.tokenDaysPreset30': '30 days (1 month)',
    'cms.tokenDaysPreset90': '90 days (3 months)',
    'cms.tokenDaysPreset180': '180 days (6 months)',
    'cms.tokenDaysPreset365': '365 days (1 year)',
    'cms.tokenDaysEffectiveNotice': 'Note: Changes apply to new login sessions after saving settings.',
    'cms.daysUnit': 'days',
    'site.skipHomepage': 'Bypass homepage (direct to documentation)',
    'site.skipHomepageHint': 'When enabled, visiting the website will automatically skip the homepage and navigate directly to the first document in the content tree.',
    'site.docsAccordion': 'Auto-collapse peer sections on link click',
    'site.docsAccordionHint': 'When clicking a major section link, automatically collapse other peer sections. Clicking expand arrows keeps multiple sections open.',
    'appearance.headerShowNavigation': 'Show navigation',
    'docs.show': 'Show on website',
    'docs.showAria': 'Show {title} on website',
    'docs.hide': 'Hide from website',
    'docs.hideAria': 'Hide {title} from website',
    'docs.publishSuccess': '“{title}” is now visible on the website.',
    'cms.userSecretTitle': 'User Secret Key & Session Invalidation',
    'cms.userSecretDesc': 'Each account stores an individual secret key in the database. Rotating this secret key immediately revokes all active tokens for this user and requires re-login.',
    'cms.userSecretActionTitle': 'Rotate Secret Key & Invalidate All Sessions',
    'cms.userSecretActionHint': 'Generate a new secret key in the database for the current logged-in user, invalidating all existing sessions.',
    'cms.resetSecretBtn': 'Rotate Secret Key (Sign out all)',
    'cms.resettingSecret': 'Rotating Secret Key…',
    'cms.resetSecretConfirmTitle': 'Rotate Secret Key and Sign Out?',
    'cms.resetSecretConfirmMessage': 'Are you sure you want to rotate the secret key for the current account? This updates the secret key in the database and immediately revokes all active tokens across all devices. You will need to sign in again.',
    'cms.resetSecretConfirmBtn': 'Rotate Secret Key & Sign Out',
    'cms.resetSecretSuccess': 'Secret key successfully rotated. All active sessions have been revoked, redirecting to login…',
    'docs.hideSuccess': '“{title}” is now hidden from the website.',
    'docs.toggleError': 'Unable to change visibility.',
    'docs.viewOnSite': 'View on website',
    'docs.viewOnSiteAria': 'View “{title}” on website',
    'docs.autosaveOn': 'Autosave: {s}s',
    'docs.autosaveOff': 'Autosave: Off',
    'docs.autosaving': 'Autosaving…',
    'docs.autosaved': 'Changes autosaved.',
    'docs.autosaveTooltip': 'Autosave cycle: 30s → Off → 5s → 10s → 20s',
    'docs.autosaveIntervalNotice': 'Autosave set to {s} seconds.',
    'docs.autosaveOffNotice': 'Autosave disabled.',
    'docs.ownerTooltip': 'Owner: @{user}',
    'docs.noEditPermission': 'Only the owner or users in user access list can view/edit this page.',
    'docs.noPublishPermission': 'You do not have permission to toggle publish for this item.',
    'docs.noDeletePermission': 'Only the owner or parent group owner can delete this item.',
    'docs.userAccessTitle': 'User Access List (Permissions to view & edit)',
    'docs.userAccessHintOwner': 'Select users allowed to view, edit, and toggle publish for this page on the website:',
    'docs.userAccessHintNonOwner': 'This page is owned by @{owner}. You have been granted access to view & edit.',
    'docs.noOtherUsers': 'No other users in the system.',
    'nav.users': 'Users',
    'users.title': 'User Management',
    'users.subtitle': 'Create user accounts and configure allowed administration sections.',
    'users.createUser': 'Create Account',
    'users.username': 'Username',
    'users.usernamePlaceholder': 'Enter username (e.g. editor_john)',
    'users.password': 'Password',
    'users.passwordPlaceholder': 'Minimum 6 characters',
    'users.role': 'Role',
    'users.roleAdmin': 'Administrator (Full access)',
    'users.roleEditor': 'Editor (Restricted access)',
    'users.allowedRoutes': 'Allowed Sections (Router access)',
    'users.allowedRoutesHint': 'By default, new accounts only have access to Overview, Content tree, Change password, and the Security tab of CMS Settings. You can grant access to other sections.',
    'users.fullAccess': 'Full access (Admin)',
    'users.editPermissions': 'Edit Permissions',
    'users.resetPassword': 'Change Password',
    'users.newPasswordOptional': 'New password (leave blank to keep current)',
    'users.deleteConfirmTitle': 'Delete Account?',
    'users.deleteConfirmMessage': 'Are you sure you want to delete user “{username}”? This action cannot be undone.',
    'users.created': 'Account created successfully.',
    'users.updated': 'Account updated successfully.',
    'users.deleted': 'Account deleted successfully.',
    'users.routeOverview': 'Dashboard Overview',
    'users.routeDocs': 'Content tree',
    'users.routeCmsSettings': 'CMS Settings (Security & Sessions)',
    'users.routeSite': 'Site Settings',
    'users.routeAppearance': 'Appearance',
    'users.routeHomepage': 'Homepage Layout',
    'users.routeLanguages': 'Languages',
    'users.routeBackup': 'Backup & Restore',
    'users.empty': 'No users found.',
  },
};
function writeStoredLang(lang) {
  try {
    if (lang) window.localStorage.setItem(STORAGE_KEY, lang);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

async function fetchJson(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    let message = '';
    try {
      const data = await response.json();
      if (data && typeof data.error === 'string') message = data.error;
    } catch {
      /* ignore malformed error body */
    }
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.json();
}

function normalizeConfig(payload) {
  const raw = Array.isArray(payload)
    ? payload
    : payload?.locales || payload?.items || [];

  const locales = raw
    .filter(
      (item) =>
        item &&
        typeof item.code === 'string' &&
        item.code.trim() &&
        item.enabled !== false,
    )
    .map((item) => ({
      code: item.code.trim(),
      name: item.name || item.code.trim(),
      order: Number(item.order) || 0,
      isDefault: Boolean(item.isDefault),
    }))
    .sort(
      (a, b) =>
        a.order - b.order || a.code.localeCompare(b.code),
    );

  const explicitDefault =
    !Array.isArray(payload) && typeof payload?.defaultLocale === 'string'
      ? payload.defaultLocale
      : '';
  const defaultLocale =
    explicitDefault ||
    locales.find((locale) => locale.isDefault)?.code ||
    locales[0]?.code ||
    FALLBACK_LANG;

  return { locales, defaultLocale };
}

async function fetchMessages(code) {
  if (!code) return {};
  if (messageCache.has(code)) return messageCache.get(code);
  const data = await fetchJson(`/i18n/${encodeURIComponent(code)}`);
  const adminDict =
    data && typeof data.admin === 'object' && data.admin ? data.admin : {};
  const uiDict =
    data && typeof data.ui === 'object' && data.ui ? data.ui : {};
  const dictionary = { ...uiDict, ...adminDict };
  messageCache.set(code, dictionary);
  return dictionary;
}

function translateWith(current, fallback, key, vars) {
  let value = current ? current[key] : undefined;
  if (value === undefined) value = fallback ? fallback[key] : undefined;
  if (value === undefined) {
    const lang = readStoredLang() || FALLBACK_LANG;
    const dict = BUILTIN_MESSAGES[lang] || BUILTIN_MESSAGES.en;
    value = dict[key] || BUILTIN_MESSAGES.vi[key] || BUILTIN_MESSAGES.en[key];
  }
  if (value === undefined) return key;
  if (typeof value !== 'string') value = String(value);
  if (vars) {
    value = value.replace(/\{(\w+)\}/g, (match, name) =>
      vars[name] === undefined || vars[name] === null ? match : String(vars[name]),
    );
  }
  return value;
}

/** Translate outside of React (e.g. lib/api.js) using the active language. */
export function translateCurrent(key, vars) {
  return translateWith(activeMessages, activeDefaultMessages, key, vars);
}

function intlLocale(code) {
  if (code === 'vi') return 'vi-VN';
  if (code === 'en') return 'en-US';
  return code;
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [state, setState] = useState(() => ({
    lang: readStoredLang() || FALLBACK_LANG,
    locales: [],
    defaultLocale: FALLBACK_LANG,
    messages: {},
    ready: false,
  }));
  const langRef = useRef(state.lang);
  const messagesRef = useRef(state.messages);
  const requestRef = useRef(0);
  const startedRef = useRef(false);

  const load = useCallback(async (preferredLang) => {
    const requestId = ++requestRef.current;

    let config;
    try {
      config = normalizeConfig(await fetchJson('/i18n'));
    } catch {
      if (requestId !== requestRef.current) return;
      setState((current) => ({ ...current, ready: true }));
      return;
    }

    if (requestId !== requestRef.current) return;

    const codes = new Set(config.locales.map((locale) => locale.code));
    let nextLang = preferredLang;
    if (!nextLang || !codes.has(nextLang)) {
      const stored = readStoredLang();
      nextLang = codes.has(stored) ? stored : config.defaultLocale;
    }
    if (!codes.has(nextLang)) {
      nextLang = config.locales[0]?.code || config.defaultLocale;
    }

    const targets = [fetchMessages(config.defaultLocale)];
    if (nextLang !== config.defaultLocale) targets.push(fetchMessages(nextLang));

    let messages = {};
    const results = await Promise.allSettled(targets);
    if (results[0]?.status === 'fulfilled') {
      messages[config.defaultLocale] = results[0].value;
    }
    if (nextLang !== config.defaultLocale && results[1]?.status === 'fulfilled') {
      messages[nextLang] = results[1].value;
    }

    if (requestId !== requestRef.current) return;

    langRef.current = nextLang;
    messagesRef.current = messages;
    writeStoredLang(nextLang);
    setState({
      lang: nextLang,
      locales: config.locales,
      defaultLocale: config.defaultLocale,
      messages,
      ready: true,
    });
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    load(readStoredLang());
  }, [load]);

  useEffect(() => {
    if (state.lang) document.documentElement.lang = state.lang;
    activeMessages = state.messages[state.lang] || {};
    activeDefaultMessages = state.messages[state.defaultLocale] || {};
  }, [state.lang, state.messages, state.defaultLocale]);

  const setLang = useCallback(
    async (next) => {
      if (!next || next === langRef.current) return;
      if (!state.locales.some((locale) => locale.code === next)) return;

      langRef.current = next;
      writeStoredLang(next);
      setState((current) => ({ ...current, lang: next }));

      if (messagesRef.current[next]) return;
      const requestId = requestRef.current;
      try {
        const dictionary = await fetchMessages(next);
        if (requestId !== requestRef.current) return;
        messagesRef.current = {
          ...messagesRef.current,
          [next]: dictionary,
        };
        setState((current) => ({
          ...current,
          messages: messagesRef.current,
        }));
      } catch {
        /* fall back to the default locale (or the key) */
      }
    },
    [state.locales],
  );

  const reload = useCallback(async () => {
    messageCache.clear();
    await load(langRef.current);
  }, [load]);

  const t = useCallback(
    (key, vars) =>
      translateWith(
        state.messages[state.lang],
        state.messages[state.defaultLocale],
        key,
        vars,
      ),
    [state.lang, state.messages, state.defaultLocale],
  );

  const locale = intlLocale(state.lang);

  const value = useMemo(
    () => ({
      lang: state.lang,
      locale,
      setLang,
      t,
      locales: state.locales,
      defaultLocale: state.defaultLocale,
      ready: state.ready,
      reload,
    }),
    [
      state.lang,
      state.locales,
      state.defaultLocale,
      state.ready,
      locale,
      setLang,
      t,
      reload,
    ],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}
