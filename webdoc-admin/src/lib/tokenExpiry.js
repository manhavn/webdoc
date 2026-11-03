export function getTokenExp(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(json);
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

export function formatTokenRemaining(diffSeconds, t) {
  if (diffSeconds === null || diffSeconds === undefined) {
    return {
      expired: false,
      text: '—',
      warning: '',
    };
  }

  if (diffSeconds <= 0) {
    return {
      expired: true,
      text: t ? t('nav.tokenExpired') : 'đã đăng xuất',
      warning: t
        ? t('nav.tokenExpiredWarning')
        : 'bạn cần copy những thứ đang làm vào nơi khác và đăng nhập lại',
    };
  }

  const s = Math.floor(diffSeconds);
  if (s < 60) {
    return {
      expired: false,
      text: `${s} ${t ? t('nav.unitSeconds') : 'giây'}`,
      warning: '',
    };
  }

  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);

  if (d > 0) {
    const minText = `${m} ${t ? t('nav.unitMinutes') : 'phút'}`;
    const hrText = `${h} ${t ? t('nav.unitHours') : 'giờ'}`;
    const dayText = `${d} ${t ? t('nav.unitDays') : 'ngày'}`;
    return {
      expired: false,
      text: `${minText} ${hrText} ${dayText}`,
      warning: '',
    };
  }

  if (h > 0) {
    const minText = `${m} ${t ? t('nav.unitMinutes') : 'phút'}`;
    const hrText = `${h} ${t ? t('nav.unitHours') : 'giờ'}`;
    return {
      expired: false,
      text: `${minText} ${hrText}`,
      warning: '',
    };
  }

  return {
    expired: false,
    text: `${m} ${t ? t('nav.unitMinutes') : 'phút'}`,
    warning: '',
  };
}
