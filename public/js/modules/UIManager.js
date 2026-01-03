export class UIManager {
    constructor(worldManager, modalId = 'room-modal', formId = 'room-form') {
        this.worldManager = worldManager;
        this.modal = document.getElementById(modalId);
        this.form = document.getElementById(formId);

        this.currentRoomId = null;
        this.pendingGridPos = null;

        this.pendingGridPos = null;
        this.isAdmin = false;

        this.setupModal();
    }

    setAdmin(isAdmin) {
        this.isAdmin = isAdmin;
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

        const approveBtn = document.getElementById('btn-approve');
        if (approveBtn) approveBtn.addEventListener('click', () => this.approveRoom());
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
        this.setError('');
    }

    setError(msg) {
        const errEl = document.getElementById('room-error');
        if (errEl) errEl.textContent = msg;
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
        this.setError('');

        const deleteBtn = document.getElementById('btn-delete');
        if (deleteBtn) deleteBtn.style.display = 'none';

        const approveBtn = document.getElementById('btn-approve');
        if (approveBtn) approveBtn.style.display = 'none';

        const saveBtn = document.getElementById('btn-save');
        if (saveBtn) {
            saveBtn.textContent = this.isAdmin ? "Create Room" : "Apply for Reservation";
            saveBtn.style.display = 'inline-block';
        }

        this.setFormReadOnly(false);
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
        this.setError('');

        const deleteBtn = document.getElementById('btn-delete');
        // Only Admin or maybe Owner (if we tracked it) can delete. For now Admin only for existing rooms?
        // Or if it's pending and not admin?
        // Prompt: "Admin... approve... modify".
        if (deleteBtn) deleteBtn.style.display = this.isAdmin ? 'inline-block' : 'none';

        const saveBtn = document.getElementById('btn-save');
        const approveBtn = document.getElementById('btn-approve');

        if (room.status === 'pending') {
            if (this.isAdmin) {
                // Admin: Can Edit, Approve, Delete
                if (saveBtn) {
                    saveBtn.textContent = "Save Changes";
                    saveBtn.style.display = 'inline-block';
                }
                if (approveBtn) approveBtn.style.display = 'inline-block';
                this.setFormReadOnly(false);
            } else {
                // User: View Pending Application (Read Only)
                if (saveBtn) saveBtn.style.display = 'none';
                if (approveBtn) approveBtn.style.display = 'none';
                if (deleteBtn) deleteBtn.style.display = 'none'; // Users can't delete once applied? Or maybe they can cancel? Let's say Read Only.
                this.setFormReadOnly(true);
            }
        } else {
            // Approved
            if (this.isAdmin) {
                if (saveBtn) {
                    saveBtn.textContent = "Save Changes";
                    saveBtn.style.display = 'inline-block';
                }
                if (approveBtn) approveBtn.style.display = 'none'; // Already approved
                this.setFormReadOnly(false);
            } else {
                // User: View Approved Room (Read Only)
                if (saveBtn) saveBtn.style.display = 'none';
                if (approveBtn) approveBtn.style.display = 'none';
                if (deleteBtn) deleteBtn.style.display = 'none';
                this.setFormReadOnly(true);
            }
        }

        this.modal.classList.remove('hidden');
    }

    setFormReadOnly(isReadOnly) {
        const inputs = this.form.querySelectorAll('input');
        inputs.forEach(input => {
            if (input.type !== 'hidden') {
                input.disabled = isReadOnly;
            }
        });
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

        // Validation: Check Collision
        const buildingId = this.currentRoomId ?
            this.worldManager.buildings.get(this.worldManager.activeBuildingId).rooms.get(this.currentRoomId).userData.room.buildingId
            : this.pendingGridPos.buildingId;

        const building = this.worldManager.buildings.get(buildingId);
        if (building) {
            // Use pending position if new, or existing position if editing (but we might want to support move later?)
            // For now assuming position (x,y) doesn't change in modal id edit, only w/h. 
            // Actually start position is NOT editable in modal currently (hidden inputs or fixed).
            // Let's use the stored pending/current pos.

            let x, y;
            if (this.currentRoomId) {
                const r = building.rooms.get(this.currentRoomId).userData.room;
                x = r.x;
                y = r.y;
            } else {
                x = this.pendingGridPos.x;
                y = this.pendingGridPos.y;
            }

            if (building.checkCollision(x, y, width, height, this.currentRoomId)) {
                this.setError("Cannot save: Room overlaps with an existing room.");
                return;
            }
        }

        const roomData = { width, height, data: { title, imageUrl, url, bannerText } };

        if (!this.currentRoomId) {
            // New Room
            roomData.status = this.isAdmin ? 'approved' : 'pending';
        }

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

    async approveRoom() {
        if (!this.currentRoomId) return;

        await fetch(`/api/rooms/${this.currentRoomId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved' })
        });

        this.hideModal();
        this.worldManager.loadRooms(this.pendingGridPos.buildingId);
    }
}
