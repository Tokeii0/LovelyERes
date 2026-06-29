/**
 * 表格过滤管理器
 * 处理系统信息表格的搜索、类别和状态过滤
 */

// ===== debounce 工具 =====
const debounceTimers = new Map<string, number>();
function debounce(key: string, fn: () => void, delay = 150): void {
  const prev = debounceTimers.get(key);
  if (prev) clearTimeout(prev);
  debounceTimers.set(key, window.setTimeout(() => {
    debounceTimers.delete(key);
    fn();
  }, delay));
}

// ===== 过滤逻辑 =====

function checkCategoryFilter(tableType: string, row: Element, filterValue: string): boolean {
  const cells = row.querySelectorAll('td');
  switch (tableType) {
    case 'processes': return cells[3]?.textContent?.toLowerCase().includes(filterValue) || false;
    case 'services':  return cells[1]?.textContent?.toLowerCase().includes(filterValue) || false;
    case 'network':   return cells[3]?.textContent?.toLowerCase().includes(filterValue) || false;
    case 'users':     return cells[4]?.textContent?.toLowerCase().includes(filterValue) || false;
    default: return true;
  }
}

function checkStatusFilter(tableType: string, row: Element, statusValue: string): boolean {
  const cells = row.querySelectorAll('td');
  switch (tableType) {
    case 'processes': return cells[4]?.textContent?.includes(statusValue) || false;
    default: return true;
  }
}

function applyFilters(tableType: string, tbody: HTMLElement, searchTerm: string, categoryValue: string, statValue: string): void {
  const rows = tbody.querySelectorAll('tr');
  const searchLower = searchTerm.toLowerCase().trim();

  rows.forEach(row => {
    let shouldShow = true;

    // 搜索过滤
    if (searchLower) {
      shouldShow = false;
      const cells = row.querySelectorAll('td');
      for (let i = 0; i < cells.length; i++) {
        if (cells[i].textContent?.toLowerCase().includes(searchLower)) {
          shouldShow = true;
          break; // 找到匹配即跳出，不必遍历所有列
        }
      }
    }

    // 类别筛选
    if (shouldShow && categoryValue) {
      shouldShow = checkCategoryFilter(tableType, row, categoryValue.toLowerCase());
    }

    // 状态筛选
    if (shouldShow && statValue) {
      shouldShow = checkStatusFilter(tableType, row, statValue);
    }

    // 风险筛选（可疑切换，目前用于进程表）
    if (shouldShow) {
      const riskBtn = document.querySelector(`#${tableType}-risk-toggle .sys-seg-opt.active`);
      const riskMode = riskBtn?.getAttribute('data-risk') || 'all';
      if (riskMode === 'suspicious' && (row as HTMLElement).getAttribute('data-suspicious') !== '1') {
        shouldShow = false;
      }
    }

    (row as HTMLElement).style.display = shouldShow ? '' : 'none';
  });
}

// ===== 初始化 =====

export function initTableFilterManager(): void {
  (window as any).checkCategoryFilter = checkCategoryFilter;
  (window as any).checkStatusFilter = checkStatusFilter;

  // 搜索框 — 带 debounce 防抖
  (window as any).filterTable = (tableType: string, searchTerm: string) => {
    debounce(`filter-${tableType}`, () => {
      const tbody = document.getElementById(`${tableType}-table-body`);
      const filterSelect = document.getElementById(`${tableType}-filter`) as HTMLSelectElement;
      const statFilter = document.getElementById(`${tableType}-stat-filter`) as HTMLSelectElement;
      if (!tbody) return;

      const categoryValue = filterSelect ? filterSelect.value : '';
      const statValue = statFilter ? statFilter.value : '';
      applyFilters(tableType, tbody, searchTerm, categoryValue, statValue);
    });
  };

  // 类别下拉 — 立即执行
  (window as any).filterTableByCategory = (tableType: string, categoryValue: string) => {
    const tbody = document.getElementById(`${tableType}-table-body`);
    const searchInput = document.getElementById(`${tableType}-search`) as HTMLInputElement;
    const statFilter = document.getElementById(`${tableType}-stat-filter`) as HTMLSelectElement;
    if (!tbody) return;

    const searchTerm = searchInput ? searchInput.value : '';
    const statValue = statFilter ? statFilter.value : '';
    applyFilters(tableType, tbody, searchTerm, categoryValue, statValue);
  };

  // 状态下拉 — 立即执行
  (window as any).filterTableByStatus = (tableType: string, statusValue: string) => {
    const tbody = document.getElementById(`${tableType}-table-body`);
    const searchInput = document.getElementById(`${tableType}-search`) as HTMLInputElement;
    const categoryFilter = document.getElementById(`${tableType}-filter`) as HTMLSelectElement;
    if (!tbody) return;

    const searchTerm = searchInput ? searchInput.value : '';
    const categoryValue = categoryFilter ? categoryFilter.value : '';
    applyFilters(tableType, tbody, searchTerm, categoryValue, statusValue);
  };

  // 风险切换（全部 / 可疑）— 立即执行
  (window as any).filterByRisk = (tableType: string, mode: string, btn?: HTMLElement) => {
    const toggle = document.getElementById(`${tableType}-risk-toggle`);
    if (toggle) {
      toggle.querySelectorAll('.sys-seg-opt').forEach(b =>
        b.classList.toggle('active', btn ? b === btn : b.getAttribute('data-risk') === mode));
    }
    const tbody = document.getElementById(`${tableType}-table-body`);
    if (!tbody) return;
    const searchInput = document.getElementById(`${tableType}-search`) as HTMLInputElement;
    const filterSelect = document.getElementById(`${tableType}-filter`) as HTMLSelectElement;
    const statFilter = document.getElementById(`${tableType}-stat-filter`) as HTMLSelectElement;
    applyFilters(tableType, tbody, searchInput?.value || '', filterSelect?.value || '', statFilter?.value || '');
  };
}
