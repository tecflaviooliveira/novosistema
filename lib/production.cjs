function monthLabel(year, month) {
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${meses[month - 1]}/${year}`;
}

function buildMonthlyReports(records) {
  const map = {};

  records.forEach((record) => {
    if (!record || !record.data) return;
    const [yearText, monthText] = String(record.data).split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    if (!year || !month) return;

    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (!map[key]) {
      map[key] = {
        key,
        year,
        month,
        label: monthLabel(year, month),
        orcamento: 0,
        aprovada: 0,
        garantia: 0,
        remoto: 0,
        total: 0,
        modelos: Object.create(null),
        taxaTotal: 0,
        aprovadaTotal: 0,
        isentos: 0,
        comTaxa: 0,
        updatedAt: new Date().toISOString()
      };
    }

    const status = record.status || 'orcamento';
    if (['orcamento', 'aprovada', 'garantia', 'remoto'].includes(status)) {
      map[key][status] += 1;
      map[key].total += 1;
    }

    if (record.modelo) {
      map[key].modelos[record.modelo] = (map[key].modelos[record.modelo] || 0) + 1;
    }

    if (status === 'orcamento') {
      if (record.taxa === 'taxa') {
        map[key].taxaTotal += 100;
        map[key].comTaxa += 1;
      } else if (record.taxa === 'outros') {
        map[key].taxaTotal += Number(record.valor) || 0;
        map[key].comTaxa += 1;
      } else {
        map[key].isentos += 1;
      }
    } else if (status === 'aprovada') {
      map[key].aprovadaTotal += Number(record.valor) || 0;
    }
  });

  return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
}

function recordArchiveKey(record) {
  return [
    record?.os || '',
    record?.status || 'orcamento'
  ].map((value) => String(value).trim().toUpperCase()).join('|');
}

function mergeArchivedRecords(existingRecords, records) {
  const map = {};
  [...(Array.isArray(existingRecords) ? existingRecords : []), ...records].forEach((record) => {
    if (!record || !record.data || !record.os) return;
    const key = recordArchiveKey(record);
    const existing = map[key];
    if (!existing || String(record.data || '') >= String(existing.data || '')) {
      map[key] = record;
    }
  });
  return Object.values(map).sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));
}

function snapshot(input = {}, existing = {}) {
  const tecnico = typeof input.tecnico === 'string' ? input.tecnico : '';
  const records = (Array.isArray(input.records) ? input.records : []).map((record) => (
    record && typeof record.tecnico !== 'string' && tecnico ? { ...record, tecnico } : record
  ));
  const archivedRecords = mergeArchivedRecords(
    Array.isArray(input.archivedRecords) ? input.archivedRecords : existing.archivedRecords,
    records
  ).map((record) => typeof record.tecnico === 'string' ? record : { ...record, tecnico: '' });

  return {
    records,
    archivedRecords,
    monthlyReports: buildMonthlyReports(archivedRecords),
    tecnico
  };
}

module.exports = { snapshot };
