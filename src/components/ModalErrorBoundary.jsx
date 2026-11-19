import { Component } from 'react';
import useAlertReducer from '../store/AlertReducer';
import { isChunkLoadError, reloadOnceForChunkError } from '../shared/helpers/chunkReload';

// Contains a crash (or failed lazy import) inside a modal so it closes the
// modal with an alert instead of bubbling up to the router's error page.
class ModalErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Modal crashed:', error, info?.componentStack);

    if (isChunkLoadError(error) && reloadOnceForChunkError()) return;

    useAlertReducer.getState().error(
      isChunkLoadError(error)
        ? 'A new version of the app is available. Please refresh the page.'
        : 'Something went wrong while opening this window. Please try again.'
    );
    this.props.onClose?.();
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

export default ModalErrorBoundary;
