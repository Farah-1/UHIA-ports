import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, deleteDoc, setDoc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDgiNw5Dt6EkiokRjznzGkfZvVuDN0APPk",
    authDomain: "uhia-attendancesystem.firebaseapp.com",
    projectId: "uhia-attendancesystem",
    storageBucket: "uhia-attendancesystem.firebasestorage.app",
    messagingSenderId: "104444545133",
    appId: "1:104444545133:web:f40607b93fb90a8f511764"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- 1. ربط الأحداث (Event Listeners) عند تحميل الصفحة ---
document.addEventListener('DOMContentLoaded', () => {
    // التحقق من الصلاحيات
    checkAuth();

    // أزرار التنقل (Sidebar)
    document.getElementById('nav-attendance').addEventListener('click', (e) => showSection('attendance', e.currentTarget));
    document.getElementById('nav-users').addEventListener('click', (e) => showSection('users', e.currentTarget));
    document.getElementById('nav-facilities').addEventListener('click', (e) => showSection('facilities', e.currentTarget));

    // القائمة الجانبية للموبايل
    document.getElementById('btn-toggle-sidebar').addEventListener('click', toggleSidebar);
    document.getElementById('overlay').addEventListener('click', closeAll);

    // البحث
    document.getElementById('search-attendance').addEventListener('keyup', filterAttendance);

    // الأزرار الإجرائية
    document.getElementById('btn-logout').addEventListener('click', logoutAdmin);
    document.getElementById('btn-export-excel').addEventListener('click', exportToExcel);
    document.getElementById('btn-open-fac-modal').addEventListener('click', () => openModal('fac-modal'));
    document.getElementById('btn-save-facility').addEventListener('click', saveFacility);
    document.getElementById('btn-confirm-update-user').addEventListener('click', updateUser);

    // أزرار الإغلاق (داخل المودال)
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
});

// --- 2. وظائف الواجهة (UI Functions) ---
function checkAuth() {
    let user = JSON.parse(sessionStorage.getItem('userData'));
    if (!user || user.role !== 'admin') {
        window.location.href = "index.html";
    } else {
        refreshData();
    }
}

function showSection(section, clickedElement) {
    ['attendance', 'users', 'facilities'].forEach(s => {
        document.getElementById(`sec-${s}`).style.display = s === section ? 'block' : 'none';
    });
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (clickedElement) clickedElement.classList.add('active');
    
    if (window.innerWidth <= 768) closeAll();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    sidebar.classList.toggle('active');
    overlay.style.display = sidebar.classList.contains('active') ? 'block' : 'none';
}

function closeAll() {
    document.getElementById('sidebar').classList.remove('active');
    closeModal();
}

function openModal(id) {
    document.getElementById(id).style.display = 'block';
    document.getElementById('overlay').style.display = 'block';
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    document.getElementById('overlay').style.display = 'none';
}

// --- 3. وظائف Firebase ---
async function refreshData() {
    await Promise.all([
        loadAttendance(),
        loadFacilities(),
        loadUsersData(),
        countActiveUsers()
    ]);
}

async function loadAttendance() {
    const q = query(collection(db, "AttendanceLogs"), orderBy("loginTime", "desc"));
    const snap = await getDocs(q);
    const table = document.getElementById('attendance-table');
    table.innerHTML = "";
    document.getElementById('stat-today').innerText = snap.size;
    
    snap.forEach(d => {
        const data = d.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${data.fullName}<br><small>${data.nationalID}</small></td>
            <td>${data.facility}</td>
            <td>${data.shift}</td>
            <td>${data.loginTime ? data.loginTime.toDate().toLocaleTimeString('ar-EG') : '-'}</td>
            <td>${data.logoutTime ? data.logoutTime.toDate().toLocaleTimeString('ar-EG') : '<b style="color:var(--success)">نشط حالياً</b>'}</td>
            <td>${data.workDuration || '-'}</td>
            <td><button class="btn-delete-row btn-delete">حذف</button></td>
        `;
        // ربط زر الحذف
        tr.querySelector('.btn-delete-row').onclick = () => deleteRecord('AttendanceLogs', d.id);
        table.appendChild(tr);
    });
}

async function loadUsersData() {
    const snap = await getDocs(collection(db, "UsersRegistry"));
    const table = document.getElementById('users-table');
    table.innerHTML = "";
    let uCount = 0;
    
    snap.forEach(d => {
        const data = d.data();
        if(data.role === 'admin') return;
        uCount++;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${data.fullName || '-'}</b></td>
            <td>${data.nationalID || '-'}</td>
            <td><code>${data.password || '-'}</code></td>
            <td>${data.governorate || '-'} / ${data.facility || '-'}</td>
            <td>${data.phoneNumber || '-'}</td>
            <td>
                <button class="btn-edit-row btn-edit">تعديل</button>
                <button class="btn-delete-user btn-delete">حذف</button>
            </td>
        `;
        // ربط أزرار التعديل والحذف
        tr.querySelector('.btn-edit-row').onclick = () => openEditUserModal(d.id, data);
        tr.querySelector('.btn-delete-user').onclick = () => deleteRecord('UsersRegistry', d.id);
        table.appendChild(tr);
    });
    document.getElementById('stat-users').innerText = uCount;
}

async function countActiveUsers() {
    const snap = await getDocs(collection(db, "AttendanceLogs"));
    const activeNow = snap.docs.filter(doc => !doc.data().logoutTime);
    document.getElementById('stat-active').innerText = activeNow.length;
}

async function loadFacilities() {
    const snap = await getDocs(collection(db, "FacilitiesReference"));
    const table = document.getElementById('facilities-table');
    table.innerHTML = "";
    document.getElementById('stat-fac').innerText = snap.size;
    
    snap.forEach(d => {
        const data = d.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${data.facilityName}</td>
            <td>${data.governorate}</td>
            <td>${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}</td>
            <td><button class="btn-delete-fac btn-delete">حذف</button></td>
        `;
        tr.querySelector('.btn-delete-fac').onclick = () => deleteRecord('FacilitiesReference', d.id);
        table.appendChild(tr);
    });
}

async function deleteRecord(col, id) {
    if(confirm("هل أنت متأكد من الحذف؟")) {
        await deleteDoc(doc(db, col, id));
        refreshData();
    }
}

async function saveFacility() {
    const name = document.getElementById('m-fac-name').value;
    const gov = document.getElementById('m-fac-gov').value;
    const lat = parseFloat(document.getElementById('m-fac-lat').value);
    const lng = parseFloat(document.getElementById('m-fac-lng').value);
    
    if(!name || !gov || isNaN(lat)) return alert("أكمل كافة البيانات");
    
    const id = `${gov}-${name}`.replace(/\s+/g, '_');
    await setDoc(doc(db, "FacilitiesReference", id), { facilityName: name, governorate: gov, lat, lng });
    closeModal();
    refreshData();
}

function openEditUserModal(id, data) {
    document.getElementById('edit-u-id').value = id;
    document.getElementById('edit-u-name').value = data.fullName || '';
    document.getElementById('edit-u-ni').value = data.nationalID || '';
    document.getElementById('edit-u-pass').value = data.password || '';
    document.getElementById('edit-u-phone').value = data.phoneNumber || '';
    openModal('edit-user-modal');
}

async function updateUser() {
    const id = document.getElementById('edit-u-id').value;
    const updatedData = {
        fullName: document.getElementById('edit-u-name').value,
        nationalID: document.getElementById('edit-u-ni').value,
        password: document.getElementById('edit-u-pass').value,
        phoneNumber: document.getElementById('edit-u-phone').value
    };
    await updateDoc(doc(db, "UsersRegistry", id), updatedData);
    alert("تم التحديث بنجاح");
    closeModal();
    refreshData();
}

// --- 4. وظائف إضافية ---
function filterAttendance() {
    let input = document.getElementById('search-attendance').value.toLowerCase();
    document.querySelectorAll('#attendance-table tr').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(input) ? '' : 'none';
    });
}

function exportToExcel() {
    const table = document.getElementById("attendance-table-to-export");
    const rows = Array.from(table.querySelectorAll("tr"));
    const worksheetData = rows.map(row => {
        const cells = Array.from(row.querySelectorAll("th, td"));
        return cells.slice(0, 6).map(cell => cell.innerText.trim());
    });
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    worksheet['!dir'] = 'rtl';
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    XLSX.writeFile(workbook, `UHIA_Attendance_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function logoutAdmin() {
    sessionStorage.clear(); 
    window.location.href = "index.html";
}