import { useState, useCallback } from 'react';

// Toast tối giản (không thêm thư viện). Trả về { toast, show }.
export default function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);
  return { toast, show };
}
