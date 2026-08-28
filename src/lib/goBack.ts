import { router as globalRouter, type Href, type Router } from 'expo-router';

/** Back if possible; otherwise replace — avoids "GO_BACK was not handled". */
export function goBackOrReplace(router: Router, fallback: Href = '/(tabs)/home') {
  const r = (router && typeof router.replace === 'function') ? router : globalRouter;
  
  try {
    if (typeof r.canGoBack === 'function' && r.canGoBack()) {
      r.back();
      return;
    }
  } catch (e) {
    console.warn('goBackOrReplace error:', e);
  }
  
  if (typeof r.replace === 'function') {
    r.replace(fallback);
  } else {
    // Ultimate fallback if even globalRouter is weird
    globalRouter.replace(fallback);
  }
}
