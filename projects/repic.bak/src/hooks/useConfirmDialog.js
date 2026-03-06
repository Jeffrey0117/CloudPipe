import { useState, useCallback } from 'react';

/**
 * Hook for easy confirm dialog usage
 * Returns [confirm, dialogProps]
 *
 * Usage:
 *   const [confirm, dialogProps] = useConfirmDialog();
 *
 *   // In handler:
 *   const result = await confirm('確定要刪除嗎？', {
 *     title: '刪除確認',
 *     confirmText: '刪除',
 *     danger: true
 *   });
 *   if (result) { ... }
 *
 *   // In JSX:
 *   <ConfirmDialog {...dialogProps} />
 */
export function useConfirmDialog() {
  const [state, setState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '確認',
    cancelText: '取消',
    danger: false,
    resolve: null
  });

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        message,
        title: options.title || '',
        confirmText: options.confirmText || '確認',
        cancelText: options.cancelText || '取消',
        danger: options.danger || false,
        resolve
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState(prev => ({ ...prev, isOpen: false }));
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState(prev => ({ ...prev, isOpen: false }));
  }, [state.resolve]);

  const dialogProps = {
    isOpen: state.isOpen,
    title: state.title,
    message: state.message,
    confirmText: state.confirmText,
    cancelText: state.cancelText,
    danger: state.danger,
    onConfirm: handleConfirm,
    onCancel: handleCancel
  };

  return [confirm, dialogProps];
}

export default useConfirmDialog;
