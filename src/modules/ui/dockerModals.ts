  import type { DockerCopyDirection, DockerCopyRequest } from '../docker/types';

type EditModalOptions = {
  containerName: string;
  initialPath?: string;
  loadContent: (path: string) => Promise<string>;
  saveContent: (path: string, content: string) => Promise<void>;
};

type CopyModalOptions = {
  containerName: string;
  onSubmit: (request: DockerCopyRequest) => Promise<void>;
};

export class DockerLogsModal {
  private overlay: HTMLElement;
  private titleEl: HTMLElement;
  private bodyEl: HTMLElement;

  constructor() {
    this.overlay = this.createOverlay();
    this.titleEl = this.overlay.querySelector('.docker-modal-title') as HTMLElement;
    this.bodyEl = this.overlay.querySelector('.docker-modal-body') as HTMLElement;
  }

  private createOverlay(): HTMLElement {
    const existing = document.querySelector<HTMLElement>('.docker-logs-modal');
    if (existing) {
      return existing;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'docker-modal-overlay docker-logs-modal';
    wrapper.innerHTML = `
      <div class="docker-modal">
        <div class="docker-modal-header">
          <h3 class="docker-modal-title"></h3>
          <div class="docker-modal-actions">
            <button class="modern-btn secondary" data-action="copy">复制</button>
            <button class="docker-modal-close" aria-label="关闭">×</button>
          </div>
        </div>
        <div class="docker-modal-body"></div>
      </div>
    `;

    document.body.appendChild(wrapper);

    wrapper.addEventListener('click', (event) => {
      if (event.target === wrapper || (event.target as HTMLElement).classList.contains('docker-modal-close')) {
        this.hide();
      }
    });

    const copyBtn = wrapper.querySelector('[data-action="copy"]') as HTMLButtonElement;
    copyBtn.addEventListener('click', () => {
      const text = this.bodyEl.textContent || '';
      navigator.clipboard.writeText(text).then(() => {
        window.showNotification?.('日志已复制到剪贴板', 'success');
      }).catch((error) => {
        console.error('复制日志失败', error);
        window.showNotification?.('复制日志失败', 'error');
      });
    });

    return wrapper;
  }

  show(title: string, content: string): void {
    this.titleEl.textContent = title;
    this.bodyEl.innerHTML = `<pre class="docker-log-viewer">${escapeHtml(content)}</pre>`;
    this.overlay.classList.add('visible');
  }

  hide(): void {
    this.overlay.classList.remove('visible');
  }
}

export class DockerFileModal {
  private overlay: HTMLElement;
  private titleEl: HTMLElement;
  private bodyEl: HTMLElement;
  private footerEl: HTMLElement;
  private editOptions?: EditModalOptions;
  private copyOptions?: CopyModalOptions;

  constructor() {
    this.overlay = this.createOverlay();
    this.titleEl = this.overlay.querySelector('.docker-modal-title') as HTMLElement;
    this.bodyEl = this.overlay.querySelector('.docker-modal-body') as HTMLElement;
    this.footerEl = this.overlay.querySelector('.docker-modal-footer') as HTMLElement;
  }

  private createOverlay(): HTMLElement {
    const existing = document.querySelector<HTMLElement>('.docker-file-modal');
    if (existing) {
      return existing;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'docker-modal-overlay docker-file-modal';
    wrapper.innerHTML = `
      <div class="docker-modal">
        <div class="docker-modal-header">
          <h3 class="docker-modal-title"></h3>
          <button class="docker-modal-close" aria-label="关闭">×</button>
        </div>
        <div class="docker-modal-body"></div>
        <div class="docker-modal-footer"></div>
      </div>
    `;

    document.body.appendChild(wrapper);

    wrapper.addEventListener('click', (event) => {
      if (event.target === wrapper || (event.target as HTMLElement).classList.contains('docker-modal-close')) {
        this.hide();
      }
    });

    return wrapper;
  }

  async showEdit(options: EditModalOptions): Promise<void> {
    this.editOptions = options;
    this.titleEl.textContent = `编辑容器文件 - ${options.containerName}`;
    this.bodyEl.innerHTML = `
      <div class="docker-edit-form">
        <label class="docker-form-label">
          文件路径
          <input type="text" class="docker-input" data-field="path" placeholder="例如 /etc/nginx/nginx.conf" value="${options.initialPath ?? ''}">
        </label>
        <div class="docker-edit-actions">
          <button class="modern-btn secondary" data-action="load">加载文件</button>
        </div>
        <div class="docker-edit-editor" data-editor hidden>
          <textarea class="docker-textarea" data-field="content" spellcheck="false"></textarea>
        </div>
      </div>
    `;

    this.footerEl.innerHTML = `
      <button class="modern-btn secondary" data-action="cancel">取消</button>
      <button class="modern-btn primary" data-action="save" disabled>保存修改</button>
    `;

    this.bindEditEvents();
    this.overlay.classList.add('visible');
  }

  showCopy(options: CopyModalOptions): void {
    this.copyOptions = options;
    this.titleEl.textContent = `容器文件复制 - ${options.containerName}`;
    this.bodyEl.innerHTML = `
      <div class="docker-copy-form">
        <label class="docker-form-label">
          复制方向
          <select class="docker-input" data-field="direction">
            <option value="container-to-host">容器 → 服务器</option>
            <option value="host-to-container">服务器 → 容器</option>
            <option value="in-container">容器内部复制</option>
          </select>
        </label>
        <label class="docker-form-label" data-source-label>
          源路径
          <input type="text" class="docker-input" data-field="source" placeholder="容器文件路径或服务器文件路径">
        </label>
        <label class="docker-form-label" data-target-label>
          目标路径
          <input type="text" class="docker-input" data-field="target" placeholder="服务器文件路径或容器文件路径">
        </label>
        <p class="docker-form-hint">提示：服务器路径指代远程主机中的路径，可与 SFTP 路径一致。</p>
      </div>
    `;

    this.footerEl.innerHTML = `
      <button class="modern-btn secondary" data-action="cancel">取消</button>
      <button class="modern-btn primary" data-action="submit">执行复制</button>
    `;

    this.bindCopyEvents();
    this.overlay.classList.add('visible');
  }

  hide(): void {
    this.editOptions = undefined;
    this.copyOptions = undefined;
    this.overlay.classList.remove('visible');
  }

  private bindEditEvents(): void {
    const pathInput = this.bodyEl.querySelector<HTMLInputElement>('[data-field="path"]');
    const contentArea = this.bodyEl.querySelector<HTMLTextAreaElement>('[data-field="content"]');
    const editorWrapper = this.bodyEl.querySelector<HTMLElement>('[data-editor]');
    const loadButton = this.bodyEl.querySelector<HTMLButtonElement>('[data-action="load"]');
    const saveButton = this.footerEl.querySelector<HTMLButtonElement>('[data-action="save"]');
    const cancelButton = this.footerEl.querySelector<HTMLButtonElement>('[data-action="cancel"]');

    if (!pathInput || !loadButton || !editorWrapper || !contentArea || !saveButton || !cancelButton || !this.editOptions) {
      return;
    }

    const { loadContent, saveContent } = this.editOptions;

    loadButton.addEventListener('click', async () => {
      const path = pathInput.value.trim();
      if (!path) {
        window.showNotification?.('请输入文件路径', 'warning');
        return;
      }
      try {
        loadButton.disabled = true;
        loadButton.textContent = '加载中...';
        const content = await loadContent(path);
        contentArea.value = content;
        editorWrapper.hidden = false;
        saveButton.disabled = false;
      } catch (error) {
        console.error('加载容器文件失败', error);
        window.showNotification?.(`加载文件失败: ${error}`, 'error');
      } finally {
        loadButton.disabled = false;
        loadButton.textContent = '加载文件';
      }
    });

    saveButton.addEventListener('click', async () => {
      const path = pathInput.value.trim();
      const content = contentArea.value;
      if (!path) {
        window.showNotification?.('请输入文件路径', 'warning');
        return;
      }
      try {
        saveButton.disabled = true;
        saveButton.textContent = '保存中...';
        await saveContent(path, content);
        window.showNotification?.('容器文件已保存', 'success');
        this.hide();
      } catch (error) {
        console.error('保存容器文件失败', error);
        window.showNotification?.(`保存失败: ${error}`, 'error');
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = '保存修改';
      }
    });

    cancelButton.addEventListener('click', () => this.hide());
  }

  private bindCopyEvents(): void {
    const directionSelect = this.bodyEl.querySelector<HTMLSelectElement>('[data-field="direction"]');
    const sourceInput = this.bodyEl.querySelector<HTMLInputElement>('[data-field="source"]');
    const targetInput = this.bodyEl.querySelector<HTMLInputElement>('[data-field="target"]');
    const cancelButton = this.footerEl.querySelector<HTMLButtonElement>('[data-action="cancel"]');
    const submitButton = this.footerEl.querySelector<HTMLButtonElement>('[data-action="submit"]');

    if (!directionSelect || !sourceInput || !targetInput || !cancelButton || !submitButton || !this.copyOptions) {
      return;
    }

    const updatePlaceholders = () => {
      const direction = directionSelect.value as DockerCopyDirection;
      if (direction === 'container-to-host') {
        sourceInput.placeholder = '容器内文件路径，如 /var/log/app.log';
        targetInput.placeholder = '服务器文件路径，如 /home/user/app.log';
      } else if (direction === 'host-to-container') {
        sourceInput.placeholder = '服务器文件路径，如 /home/user/app.log';
        targetInput.placeholder = '容器内目标路径，如 /var/log/app.log';
      } else {
        sourceInput.placeholder = '容器内源路径';
        targetInput.placeholder = '容器内目标路径';
      }
    };

    directionSelect.addEventListener('change', updatePlaceholders);
    updatePlaceholders();

    cancelButton.addEventListener('click', () => this.hide());

    submitButton.addEventListener('click', async () => {
      const direction = directionSelect.value as DockerCopyDirection;
      const source = sourceInput.value.trim();
      const target = targetInput.value.trim();
      if (!source || !target) {
        window.showNotification?.('请填写源路径和目标路径', 'warning');
        return;
      }
      try {
        submitButton.disabled = true;
        submitButton.textContent = '执行中...';
        await this.copyOptions!.onSubmit({ direction, source, target });
        window.showNotification?.('文件复制任务已执行', 'success');
        this.hide();
      } catch (error) {
        console.error('执行容器文件复制失败', error);
        window.showNotification?.(`复制失败: ${error}`, 'error');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = '执行复制';
      }
    });
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
