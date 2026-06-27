import { useEffect, useState } from 'react';
import { listVersions } from '../services/wfconfigService';

// Nạp danh sách workflow version + chọn mặc định bản hiện hành.
export default function useVersions() {
  const [versions, setVersions] = useState([]);
  const [versionId, setVersionId] = useState('');
  useEffect(() => {
    listVersions().then((r) => {
      setVersions(r.data);
      const hh = r.data.find((v) => v.la_hien_hanh) || r.data[0];
      if (hh) setVersionId(hh.id);
    }).catch(() => {});
  }, []);
  return { versions, versionId, setVersionId };
}
