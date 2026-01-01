export class UIManager {
    constructor(worldManager, modalId = 'room-modal', formId = 'room-form') {
        this.worldManager = worldManager;
        this.modal = document.getElementById(modalId);
        this.form = document.getElementById(formId);

        this.currentRoomId = null;
        this.pendingGridPos = null;

        this.setupModal();
    }

    setupModal() {
        const cancelBtn = document.getElementById('btn-cancel');
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.hideModal());

        const deleteBtn = document.getElementById('btn-delete');
        if (deleteBtn) deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleDeleteClick();
        });

        if (this.form) {
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveRoom();
            });
        }
    }

    handleDeleteClick() {
        const deleteBtn = document.getElementById('btn-delete');
        if (!deleteBtn) return;

        if (deleteBtn.classList.contains('confirm-delete')) {
            // Second click: Perform Delete
            this.deleteCurrentRoom();
        } else {
            // First click: Ask for confirmation
            deleteBtn.classList.add('confirm-delete');
            deleteBtn.textContent = "Confirm Delete?";

            // Auto-reset after 3 seconds if not clicked
            this.deleteResetTimer = setTimeout(() => {
                this.resetDeleteButton();
            }, 3000);
        }
    }

    resetDeleteButton() {
        const deleteBtn = document.getElementById('btn-delete');
        if (deleteBtn) {
            deleteBtn.classList.remove('confirm-delete');
            deleteBtn.textContent = "Delete";
        }
        if (this.deleteResetTimer) {
            clearTimeout(this.deleteResetTimer);
            this.deleteResetTimer = null;
        }
    }

    // Call this when closing modal to reset state
    hideModal() {
        this.resetDeleteButton();
        if (this.modal) this.modal.classList.add('hidden');
    }

    showModalForNew(buildingId, x, y, w = 1, h = 1) {
        this.currentRoomId = null;
        this.pendingGridPos = { buildingId, x, y };

        this.setVal('room-width', w);
        this.setVal('room-height', h);
        this.setVal('room-title', '');
        this.setVal('room-image', '');
        this.setVal('room-url', '');
        this.setVal('room-banner', '');

        const deleteBtn = document.getElementById('btn-delete');
        if (deleteBtn) deleteBtn.style.display = 'none';

        this.modal.classList.remove('hidden');
    }

    showModalForRoom(room) {
        this.currentRoomId = room.id;
        this.pendingGridPos = { buildingId: room.buildingId, x: room.x, y: room.y };

        this.setVal('room-width', room.width);
        this.setVal('room-height', room.height);
        this.setVal('room-title', room.data.title || '');
        this.setVal('room-image', room.data.imageUrl || '');
        this.setVal('room-url', room.data.url || '');
        this.setVal('room-banner', room.data.bannerText || '');

        const deleteBtn = document.getElementById('btn-delete');
        if (deleteBtn) deleteBtn.style.display = 'inline-block';

        this.modal.classList.remove('hidden');
    }

    setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }

    getVal(id) {
        const el = document.getElementById(id);
        return el ? el.value : '';
    }

    async saveRoom() {
        const width = parseInt(this.getVal('room-width'));
        const height = parseInt(this.getVal('room-height'));
        const title = this.getVal('room-title');
        const imageUrl = this.getVal('room-image');
        const url = this.getVal('room-url');
        const bannerText = this.getVal('room-banner');

        const roomData = { width, height, data: { title, imageUrl, url, bannerText } };

        if (this.currentRoomId) {
            await fetch(`/api/rooms/${this.currentRoomId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(roomData)
            });
        } else {
            Object.assign(roomData, this.pendingGridPos);
            await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(roomData)
            });
        }

        this.hideModal();
        this.worldManager.loadRooms(this.pendingGridPos.buildingId);
    }

    async deleteCurrentRoom() {
        if (!this.currentRoomId) return;

        // No native confirm needed anymore
        await fetch(`/api/rooms/${this.currentRoomId}`, { method: 'DELETE' });

        this.resetDeleteButton();
        this.hideModal();
        this.worldManager.loadRooms(this.pendingGridPos.buildingId);
    }
}
