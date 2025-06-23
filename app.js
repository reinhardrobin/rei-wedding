import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

// Lucide React Icons (replace with actual imports if available or use inline SVG)
// For this example, we'll use inline SVG for simplicity as lucide-react might not be directly available in the Canvas environment without a build step.
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001 1h2a1 1 0 001-1m-6 0h6"></path>
  </svg>
);
const MoneyIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
  </svg>
);
const ListIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
  </svg>
);
const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H2v-2a3 3 0 015.356-1.857m7.5 1.857L17 20m-5-9V7m5 4v3.25M17 11H9.5V7.5M4.5 19H3v-2a3 3 0 013-3h1.5l.5-1H11l.5 1H13a3 3 0 013 3v2h-1.5m-6 0H14m-5 0h6"></path>
  </svg>
);

// Constants for categories and options
const budgetCategories = [
  'Pemberkatan Gereja', 'Gedung & Venue', 'Katering', 'Dekorasi', 'Pakaian Adat & Pengantin',
  'Undangan & Souvenir', 'Hiburan (Musik/MC)', 'Dokumentasi (Foto/Video)', 'Cincin & Mahar',
  'Transportasi', 'Perias & Busana', 'Akomodasi Tamu', 'Biaya Adat Tambahan', 'Biaya Tak Terduga'
];

const todoStages = [
  'Pra-Pernikahan', 'Pemberkatan', 'Pesta Adat (Maneat Horja)', 'Pasca-Pernikahan'
];

const paymentMethods = ['Tunai', 'Transfer Bank', 'Debit', 'Kartu Kredit', 'Lainnya'];
const paymentStatuses = ['Lunas', 'DP', 'Belum Dibayar'];
const taskStatuses = ['Belum Mulai', 'Sedang Berlangsung', 'Selesai', 'Tertunda'];
const priorities = ['Tinggi', 'Sedang', 'Rendah'];

// Utility function to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

// Utility function to format date for input type="date"
const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Utility function to format date for display
const formatDateForDisplay = (dateString) => {
  if (!dateString) return '';
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('id-ID', options);
};

function App() {
  const [activeTab, setActiveTab] = useState('summary');
  const [initialBudget, setInitialBudget] = useState({}); // Stores initial budget per category
  const [budgetItems, setBudgetItems] = useState([]); // Stores detailed expenses
  const [todoItems, setTodoItems] = useState([]); // Stores to-do list items
  const [vendors, setVendors] = useState([]); // Stores vendor contacts

  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(''); // For user messages

  // Show a message to the user
  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000); // Clear message after 3 seconds
  };

  // Firebase Initialization and Authentication
  useEffect(() => {
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;

      if (!firebaseConfig) {
        setError("Firebase config not available. Cannot connect to database.");
        setLoading(false);
        return;
      }

      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const authentication = getAuth(app);

      setDb(firestore);
      setAuth(authentication);

      const unsubscribe = onAuthStateChanged(authentication, async (user) => {
        if (user) {
          setUserId(user.uid);
          showMessage('Pengguna terautentikasi.');
        } else {
          // If no user, sign in anonymously if no custom token provided
          if (typeof __initial_auth_token === 'undefined') {
            await signInAnonymously(authentication);
            showMessage('Masuk secara anonim.');
          } else {
            // Sign in with custom token if available
            try {
              await signInWithCustomToken(authentication, __initial_auth_token);
              showMessage('Masuk dengan token kustom.');
            } catch (authError) {
              setError(`Gagal masuk dengan token kustom: ${authError.message}`);
              await signInAnonymously(authentication); // Fallback to anonymous
              showMessage('Token kustom gagal, masuk secara anonim.');
            }
          }
        }
        setLoading(false);
      });

      return () => unsubscribe(); // Cleanup auth listener
    } catch (err) {
      console.error("Kesalahan inisialisasi Firebase:", err);
      setError(`Kesalahan inisialisasi Firebase: ${err.message}`);
      setLoading(false);
    }
  }, []);

  // Fetch initial data when db and userId are ready
  useEffect(() => {
    if (!db || !userId) return;

    // Fetch Initial Budget
    const initialBudgetRef = doc(db, `artifacts/${__app_id}/users/${userId}/wedding_settings`, 'initial_budget');
    const unsubscribeBudget = onSnapshot(initialBudgetRef, (docSnap) => {
      if (docSnap.exists()) {
        setInitialBudget(docSnap.data() || {});
      } else {
        setInitialBudget({}); // Reset if no document
      }
    }, (error) => {
      console.error("Error fetching initial budget:", error);
      setError(`Gagal mengambil anggaran awal: ${error.message}`);
    });

    // Fetch Detailed Budget Items
    const budgetItemsRef = collection(db, `artifacts/${__app_id}/users/${userId}/wedding_budget`);
    const unsubscribeBudgetItems = onSnapshot(budgetItemsRef, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBudgetItems(items.sort((a, b) => new Date(b.date) - new Date(a.date))); // Sort by date desc
    }, (error) => {
      console.error("Error fetching budget items:", error);
      setError(`Gagal mengambil item anggaran: ${error.message}`);
    });

    // Fetch To-Do Items
    const todoItemsRef = collection(db, `artifacts/${__app_id}/users/${userId}/wedding_todos`);
    const unsubscribeTodoItems = onSnapshot(todoItemsRef, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTodoItems(items.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))); // Sort by due date asc
    }, (error) => {
      console.error("Error fetching todo items:", error);
      setError(`Gagal mengambil item tugas: ${error.message}`);
    });

    // Fetch Vendors
    const vendorsRef = collection(db, `artifacts/${__app_id}/users/${userId}/wedding_vendors`);
    const unsubscribeVendors = onSnapshot(vendorsRef, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVendors(items.sort((a, b) => a.category.localeCompare(b.category))); // Sort by category
    }, (error) => {
      console.error("Error fetching vendors:", error);
      setError(`Gagal mengambil vendor: ${error.message}`);
    });

    return () => {
      unsubscribeBudget();
      unsubscribeBudgetItems();
      unsubscribeTodoItems();
      unsubscribeVendors();
    };
  }, [db, userId]);


  // --- CRUD Operations for Firestore ---

  // Set Initial Budget for a category
  const handleSetInitialBudget = async (category, amount) => {
    if (!db || !userId) { showMessage('Database atau ID pengguna tidak siap.'); return; }
    try {
      const initialBudgetRef = doc(db, `artifacts/${__app_id}/users/${userId}/wedding_settings`, 'initial_budget');
      await updateDoc(initialBudgetRef, { [category]: amount }, { merge: true });
      showMessage(`Anggaran awal untuk ${category} diperbarui.`);
    } catch (e) {
      console.error("Error updating initial budget: ", e);
      setError(`Gagal memperbarui anggaran awal: ${e.message}`);
    }
  };

  // Add Detailed Budget Item
  const addBudgetItem = async (item) => {
    if (!db || !userId) { showMessage('Database atau ID pengguna tidak siap.'); return; }
    try {
      await addDoc(collection(db, `artifacts/${__app_id}/users/${userId}/wedding_budget`), item);
      showMessage('Item anggaran berhasil ditambahkan!');
    } catch (e) {
      console.error("Error adding budget item: ", e);
      setError(`Gagal menambahkan item anggaran: ${e.message}`);
    }
  };

  // Update Detailed Budget Item
  const updateBudgetItem = async (id, updatedItem) => {
    if (!db || !userId) { showMessage('Database atau ID pengguna tidak siap.'); return; }
    try {
      const itemDoc = doc(db, `artifacts/${__app_id}/users/${userId}/wedding_budget`, id);
      await updateDoc(itemDoc, updatedItem);
      showMessage('Item anggaran berhasil diperbarui!');
    } catch (e) {
      console.error("Error updating budget item: ", e);
      setError(`Gagal memperbarui item anggaran: ${e.message}`);
    }
  };

  // Delete Detailed Budget Item
  const deleteBudgetItem = async (id) => {
    if (!db || !userId) { showMessage('Database atau ID pengguna tidak siap.'); return; }
    try {
      const itemDoc = doc(db, `artifacts/${__app_id}/users/${userId}/wedding_budget`, id);
      await deleteDoc(itemDoc);
      showMessage('Item anggaran berhasil dihapus.');
    } catch (e) {
      console.error("Error deleting budget item: ", e);
      setError(`Gagal menghapus item anggaran: ${e.message}`);
    }
  };

  // Add To-Do Item
  const addTodoItem = async (item) => {
    if (!db || !userId) { showMessage('Database atau ID pengguna tidak siap.'); return; }
    try {
      await addDoc(collection(db, `artifacts/${__app_id}/users/${userId}/wedding_todos`), item);
      showMessage('Tugas berhasil ditambahkan!');
    } catch (e) {
      console.error("Error adding todo item: ", e);
      setError(`Gagal menambahkan tugas: ${e.message}`);
    }
  };

  // Update To-Do Item
  const updateTodoItem = async (id, updatedItem) => {
    if (!db || !userId) { showMessage('Database atau ID pengguna tidak siap.'); return; }
    try {
      const itemDoc = doc(db, `artifacts/${__app_id}/users/${userId}/wedding_todos`, id);
      await updateDoc(itemDoc, updatedItem);
      showMessage('Tugas berhasil diperbarui!');
    } catch (e) {
      console.error("Error updating todo item: ", e);
      setError(`Gagal memperbarui tugas: ${e.message}`);
    }
  };

  // Delete To-Do Item
  const deleteTodoItem = async (id) => {
    if (!db || !userId) { showMessage('Database atau ID pengguna tidak siap.'); return; }
    try {
      const itemDoc = doc(db, `artifacts/${__app_id}/users/${userId}/wedding_todos`, id);
      await deleteDoc(itemDoc);
      showMessage('Tugas berhasil dihapus.');
    } catch (e) {
      console.error("Error deleting todo item: ", e);
      setError(`Gagal menghapus tugas: ${e.message}`);
    }
  };

  // Add Vendor
  const addVendor = async (vendor) => {
    if (!db || !userId) { showMessage('Database atau ID pengguna tidak siap.'); return; }
    try {
      await addDoc(collection(db, `artifacts/${__app_id}/users/${userId}/wedding_vendors`), vendor);
      showMessage('Vendor berhasil ditambahkan!');
    } catch (e) {
      console.error("Error adding vendor: ", e);
      setError(`Gagal menambahkan vendor: ${e.message}`);
    }
  };

  // Update Vendor
  const updateVendor = async (id, updatedVendor) => {
    if (!db || !userId) { showMessage('Database atau ID pengguna tidak siap.'); return; }
    try {
      const vendorDoc = doc(db, `artifacts/${__app_id}/users/${userId}/wedding_vendors`, id);
      await updateDoc(vendorDoc, updatedVendor);
      showMessage('Vendor berhasil diperbarui!');
    } catch (e) {
      console.error("Error updating vendor: ", e);
      setError(`Gagal memperbarui vendor: ${e.message}`);
    }
  };

  // Delete Vendor
  const deleteVendor = async (id) => {
    if (!db || !userId) { showMessage('Database atau ID pengguna tidak siap.'); return; }
    try {
      const vendorDoc = doc(db, `artifacts/${__app_id}/users/${userId}/wedding_vendors`, id);
      await deleteDoc(vendorDoc);
      showMessage('Vendor berhasil dihapus.');
    } catch (e) {
      console.error("Error deleting vendor: ", e);
      setError(`Gagal menghapus vendor: ${e.message}`);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 font-sans">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-t-2 border-gray-900 rounded-full animate-spin"></div>
          <div>Memuat aplikasi...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-100 text-red-800 p-4 font-sans rounded-lg shadow-md">
        <p className="text-center">{error}</p>
      </div>
    );
  }

  // Helper to calculate actual spending for a category
  const getActualSpending = (category) => {
    return budgetItems
      .filter(item => item.category === category)
      .reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  };

  // --- Components for each tab ---

  const BudgetSummary = () => {
    const totalInitialBudget = Object.values(initialBudget).reduce((sum, amount) => sum + parseFloat(amount || 0), 0);
    const totalActualSpending = budgetCategories.reduce((sum, category) => sum + getActualSpending(category), 0);
    const totalDifference = totalInitialBudget - totalActualSpending;

    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Ringkasan Anggaran Pernikahan Adat Batak Toba</h2>
        <p className="text-sm text-gray-600 mb-4">Pengguna Aktif: <span className="font-mono bg-gray-100 p-1 rounded text-xs">{userId}</span></p>

        {message && (
          <div className="bg-green-100 text-green-700 p-3 rounded-md mb-4 text-center">
            {message}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50 text-gray-600 uppercase text-sm leading-normal">
              <tr>
                <th className="py-3 px-6 text-left">Kategori</th>
                <th className="py-3 px-6 text-right">Anggaran Awal</th>
                <th className="py-3 px-6 text-right">Pengeluaran Aktual</th>
                <th className="py-3 px-6 text-right">Selisih</th>
                <th className="py-3 px-6 text-right">% Terpakai</th>
                <th className="py-3 px-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 text-sm">
              {budgetCategories.map(category => {
                const initial = parseFloat(initialBudget[category] || 0);
                const actual = getActualSpending(category);
                const difference = initial - actual;
                const percentage = initial > 0 ? (actual / initial) * 100 : 0;

                let rowClass = '';
                if (difference < 0) {
                  rowClass = 'bg-red-50'; // Overbudget
                } else if (percentage >= 90 && percentage < 100) {
                  rowClass = 'bg-yellow-50'; // Nearing budget limit
                } else if (percentage >= 100) {
                    rowClass = 'bg-red-50'; // Overbudget exactly at 100%
                }

                return (
                  <tr key={category} className={`border-b border-gray-200 hover:bg-gray-50 ${rowClass}`}>
                    <td className="py-3 px-6 text-left font-medium">{category}</td>
                    <td className="py-3 px-6 text-right">
                      <input
                        type="number"
                        value={initialBudget[category] || ''}
                        onChange={(e) => setInitialBudget({ ...initialBudget, [category]: e.target.value })}
                        onBlur={(e) => handleSetInitialBudget(category, parseFloat(e.target.value || 0))}
                        className="w-full p-2 border border-gray-300 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                        min="0"
                      />
                    </td>
                    <td className="py-3 px-6 text-right">{formatCurrency(actual)}</td>
                    <td className="py-3 px-6 text-right font-semibold">
                      {formatCurrency(difference)}
                    </td>
                    <td className="py-3 px-6 text-right">{percentage.toFixed(2)}%</td>
                    <td className="py-3 px-6 text-center">
                        <button
                          onClick={() => {
                            setInitialBudget({ ...initialBudget, [category]: 0 });
                            handleSetInitialBudget(category, 0);
                          }}
                          className="text-red-600 hover:text-red-800 font-semibold text-xs"
                          title="Reset Anggaran Awal"
                        >
                          Reset
                        </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-100 text-gray-800 uppercase text-sm leading-normal font-bold">
              <tr>
                <td className="py-3 px-6 text-left">Total</td>
                <td className="py-3 px-6 text-right">{formatCurrency(totalInitialBudget)}</td>
                <td className="py-3 px-6 text-right">{formatCurrency(totalActualSpending)}</td>
                <td className="py-3 px-6 text-right">{formatCurrency(totalDifference)}</td>
                <td className="py-3 px-6 text-right">
                  {totalInitialBudget > 0 ? ((totalActualSpending / totalInitialBudget) * 100).toFixed(2) : 0}%
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-4 text-sm text-gray-600">
          *Klik pada sel 'Anggaran Awal' untuk mengedit dan tekan 'Enter' atau klik di luar sel untuk menyimpan.
        </p>
      </div>
    );
  };

  const DetailedBudgetTracker = () => {
    const [newItem, setNewItem] = useState({
      date: formatDateForInput(new Date().toISOString()),
      category: budgetCategories[0],
      item: '',
      vendor: '',
      amount: '',
      paymentMethod: paymentMethods[0],
      status: paymentStatuses[0]
    });
    const [editingItem, setEditingItem] = useState(null); // stores the item being edited

    const handleNewItemChange = (e) => {
      const { name, value } = e.target;
      setNewItem(prev => ({ ...prev, [name]: value }));
    };

    const handleAddItem = async () => {
      if (!newItem.item || !newItem.amount || !newItem.category) {
        showMessage('Nama item, jumlah, dan kategori harus diisi.');
        return;
      }
      if (isNaN(parseFloat(newItem.amount))) {
        showMessage('Jumlah harus berupa angka.');
        return;
      }
      await addBudgetItem({ ...newItem, amount: parseFloat(newItem.amount) });
      setNewItem({
        date: formatDateForInput(new Date().toISOString()),
        category: budgetCategories[0],
        item: '',
        vendor: '',
        amount: '',
        paymentMethod: paymentMethods[0],
        status: paymentStatuses[0]
      });
    };

    const handleEditClick = (item) => {
      setEditingItem({ ...item, date: formatDateForInput(item.date) }); // Convert date for input
    };

    const handleEditChange = (e) => {
      const { name, value } = e.target;
      setEditingItem(prev => ({ ...prev, [name]: value }));
    };

    const handleUpdateItem = async () => {
      if (!editingItem || !editingItem.item || !editingItem.amount || !editingItem.category) {
        showMessage('Nama item, jumlah, dan kategori harus diisi saat mengedit.');
        return;
      }
      if (isNaN(parseFloat(editingItem.amount))) {
        showMessage('Jumlah harus berupa angka saat mengedit.');
        return;
      }
      await updateBudgetItem(editingItem.id, { ...editingItem, amount: parseFloat(editingItem.amount) });
      setEditingItem(null); // Exit editing mode
    };

    const handleDeleteClick = (id) => {
      if (window.confirm('Apakah Anda yakin ingin menghapus item anggaran ini?')) {
        deleteBudgetItem(id);
      }
    };

    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Detail Anggaran & Pelacakan Pengeluaran</h2>

        {message && (
          <div className="bg-green-100 text-green-700 p-3 rounded-md mb-4 text-center">
            {message}
          </div>
        )}

        <div className="mb-8 p-4 border border-blue-200 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-blue-800">Tambahkan Pengeluaran Baru</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700">Tanggal</label>
              <input type="date" name="date" id="date" value={newItem.date} onChange={handleNewItemChange}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">Kategori</label>
              <select name="category" id="category" value={newItem.category} onChange={handleNewItemChange}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                {budgetCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="item" className="block text-sm font-medium text-gray-700">Item</label>
              <input type="text" name="item" id="item" value={newItem.item} onChange={handleNewItemChange}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contoh: Sewa Gedung" />
            </div>
            <div>
              <label htmlFor="vendor" className="block text-sm font-medium text-gray-700">Vendor/Penyedia Jasa</label>
              <input type="text" name="vendor" id="vendor" value={newItem.vendor} onChange={handleNewItemChange}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contoh: Gedung Sejahtera" />
            </div>
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Jumlah (IDR)</label>
              <input type="number" name="amount" id="amount" value={newItem.amount} onChange={handleNewItemChange}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contoh: 5000000" min="0" />
            </div>
            <div>
              <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700">Metode Pembayaran</label>
              <select name="paymentMethod" id="paymentMethod" value={newItem.paymentMethod} onChange={handleNewItemChange}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                {paymentMethods.map(method => <option key={method} value={method}>{method}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status Pembayaran</label>
              <select name="status" id="status" value={newItem.status} onChange={handleNewItemChange}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                {paymentStatuses.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
          </div>
          <button onClick={handleAddItem}
            className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out shadow-md">
            Tambah Pengeluaran
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50 text-gray-600 uppercase text-sm leading-normal">
              <tr>
                <th className="py-3 px-6 text-left">Tanggal</th>
                <th className="py-3 px-6 text-left">Kategori</th>
                <th className="py-3 px-6 text-left">Item</th>
                <th className="py-3 px-6 text-left">Vendor</th>
                <th className="py-3 px-6 text-right">Jumlah</th>
                <th className="py-3 px-6 text-left">Metode</th>
                <th className="py-3 px-6 text-left">Status</th>
                <th className="py-3 px-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 text-sm">
              {budgetItems.map(item => (
                <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50">
                  {editingItem && editingItem.id === item.id ? (
                    <>
                      <td className="py-3 px-6">
                        <input type="date" name="date" value={editingItem.date} onChange={handleEditChange} className="w-full p-1 border rounded" />
                      </td>
                      <td className="py-3 px-6">
                        <select name="category" value={editingItem.category} onChange={handleEditChange} className="w-full p-1 border rounded">
                          {budgetCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </td>
                      <td className="py-3 px-6">
                        <input type="text" name="item" value={editingItem.item} onChange={handleEditChange} className="w-full p-1 border rounded" />
                      </td>
                      <td className="py-3 px-6">
                        <input type="text" name="vendor" value={editingItem.vendor} onChange={handleEditChange} className="w-full p-1 border rounded" />
                      </td>
                      <td className="py-3 px-6">
                        <input type="number" name="amount" value={editingItem.amount} onChange={handleEditChange} className="w-full p-1 border rounded text-right" />
                      </td>
                      <td className="py-3 px-6">
                        <select name="paymentMethod" value={editingItem.paymentMethod} onChange={handleEditChange} className="w-full p-1 border rounded">
                          {paymentMethods.map(method => <option key={method} value={method}>{method}</option>)}
                        </select>
                      </td>
                      <td className="py-3 px-6">
                        <select name="status" value={editingItem.status} onChange={handleEditChange} className="w-full p-1 border rounded">
                          {paymentStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </td>
                      <td className="py-3 px-6 text-center whitespace-nowrap">
                        <button onClick={handleUpdateItem} className="text-green-600 hover:text-green-800 font-semibold mr-2">Simpan</button>
                        <button onClick={() => setEditingItem(null)} className="text-gray-600 hover:text-gray-800 font-semibold">Batal</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 px-6">{formatDateForDisplay(item.date)}</td>
                      <td className="py-3 px-6">{item.category}</td>
                      <td className="py-3 px-6">{item.item}</td>
                      <td className="py-3 px-6">{item.vendor}</td>
                      <td className="py-3 px-6 text-right">{formatCurrency(item.amount)}</td>
                      <td className="py-3 px-6">{item.paymentMethod}</td>
                      <td className="py-3 px-6">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold
                          ${item.status === 'Lunas' ? 'bg-green-100 text-green-800' : ''}
                          ${item.status === 'DP' ? 'bg-yellow-100 text-yellow-800' : ''}
                          ${item.status === 'Belum Dibayar' ? 'bg-red-100 text-red-800' : ''}
                        `}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-center whitespace-nowrap">
                        <button onClick={() => handleEditClick(item)} className="text-blue-600 hover:text-blue-800 font-semibold mr-2" title="Edit">
                          Edit
                        </button>
                        <button onClick={() => handleDeleteClick(item.id)} className="text-red-600 hover:text-red-800 font-semibold" title="Hapus">
                          Hapus
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {budgetItems.length === 0 && (
                <tr>
                  <td colSpan="8" className="py-4 px-6 text-center text-gray-500">Belum ada pengeluaran yang tercatat.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const TodoList = () => {
    const [newItem, setNewItem] = useState({
      stage: todoStages[0],
      task: '',
      responsible: '',
      dueDate: formatDateForInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()), // Default 7 days from now
      status: taskStatuses[0],
      priority: priorities[1]
    });
    const [editingItem, setEditingItem] = useState(null);

    const handleNewItemChange = (e) => {
      const { name, value } = e.target;
      setNewItem(prev => ({ ...prev, [name]: value }));
    };

    const handleAddItem = async () => {
      if (!newItem.task || !newItem.responsible || !newItem.dueDate) {
        showMessage('Tugas, penanggung jawab, dan batas waktu harus diisi.');
        return;
      }
      await addTodoItem(newItem);
      setNewItem({
        stage: todoStages[0],
        task: '',
        responsible: '',
        dueDate: formatDateForInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()),
        status: taskStatuses[0],
        priority: priorities[1]
      });
    };

    const handleEditClick = (item) => {
      setEditingItem({ ...item, dueDate: formatDateForInput(item.dueDate) });
    };

    const handleEditChange = (e) => {
      const { name, value } = e.target;
      setEditingItem(prev => ({ ...prev, [name]: value }));
    };

    const handleUpdateItem = async () => {
      if (!editingItem || !editingItem.task || !editingItem.responsible || !editingItem.dueDate) {
        showMessage('Tugas, penanggung jawab, dan batas waktu harus diisi saat mengedit.');
        return;
      }
      await updateTodoItem(editingItem.id, editingItem);
      setEditingItem(null);
    };

    const handleDeleteClick = (id) => {
      if (window.confirm('Apakah Anda yakin ingin menghapus tugas ini?')) {
        deleteTodoItem(id);
      }
    };

    const getRowClass = (item) => {
      const today = new Date();
      const dueDate = new Date(item.dueDate);
      let className = '';

      if (item.status === 'Selesai') {
        className = 'bg-green-50';
      } else if (dueDate < today) {
        className = 'bg-red-50'; // Past due
      } else if ((dueDate - today) / (1000 * 60 * 60 * 24) <= 7) {
        className = 'bg-yellow-50'; // Due in 7 days or less
      }
      return className;
    };

    const getStatusClass = (status) => {
      switch (status) {
        case 'Selesai': return 'bg-green-100 text-green-800';
        case 'Sedang Berlangsung': return 'bg-blue-100 text-blue-800';
        case 'Tertunda': return 'bg-red-100 text-red-800';
        case 'Belum Mulai': return 'bg-gray-100 text-gray-800';
        default: return 'bg-gray-100 text-gray-800';
      }
    };

    const getPriorityClass = (priority) => {
      switch (priority) {
        case 'Tinggi': return 'bg-red-200 text-red-900';
        case 'Sedang': return 'bg-yellow-200 text-yellow-900';
        case 'Rendah': return 'bg-blue-200 text-blue-900';
        default: return 'bg-gray-200 text-gray-900';
      }
    };

    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Daftar Tugas Pernikahan</h2>

        {message && (
          <div className="bg-green-100 text-green-700 p-3 rounded-md mb-4 text-center">
            {message}
          </div>
        )}

        <div className="mb-8 p-4 border border-blue-200 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-blue-800">Tambahkan Tugas Baru</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="taskStage" className="block text-sm font-medium text-gray-700">Tahap Acara</label>
              <select name="stage" id="taskStage" value={newItem.stage} onChange={handleNewItemChange}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                {todoStages.map(stage => <option key={stage} value={stage}>{stage}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="taskDesc" className="block text-sm font-medium text-gray-700">Tugas</label>
              <input type="text" name="task" id="taskDesc" value={newItem.task} onChange={handleNewItemChange}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contoh: Atur pertemuan dengan WO" />
            </div>
            <div>
              <label htmlFor="responsible" className="block text-sm font-medium text-gray-700">Penanggung Jawab</label>
              <input type="text" name="responsible" id="responsible" value={newItem.responsible} onChange={handleNewItemChange}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contoh: Ani" />
            </div>
            <div>
              <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700">Batas Waktu</label>
              <input type="date" name="dueDate" id="dueDate" value={newItem.dueDate} onChange={handleNewItemChange}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label htmlFor="taskStatus" className="block text-sm font-medium text-gray-700">Status</label>
              <select name="status" id="taskStatus" value={newItem.status} onChange={handleNewItemChange}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                {taskStatuses.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700">Prioritas</label>
              <select name="priority" id="priority" value={newItem.priority} onChange={handleNewItemChange}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                {priorities.map(priority => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </div>
          </div>
          <button onClick={handleAddItem}
            className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out shadow-md">
            Tambah Tugas
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50 text-gray-600 uppercase text-sm leading-normal">
              <tr>
                <th className="py-3 px-6 text-left">Tahap Acara</th>
                <th className="py-3 px-6 text-left">Tugas</th>
                <th className="py-3 px-6 text-left">Penanggung Jawab</th>
                <th className="py-3 px-6 text-left">Batas Waktu</th>
                <th className="py-3 px-6 text-left">Status</th>
                <th className="py-3 px-6 text-left">Prioritas</th>
                <th className="py-3 px-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 text-sm">
              {todoItems.map(item => (
                <tr key={item.id} className={`border-b border-gray-200 hover:bg-gray-50 ${getRowClass(item)}`}>
                  {editingItem && editingItem.id === item.id ? (
                    <>
                      <td className="py-3 px-6">
                        <select name="stage" value={editingItem.stage} onChange={handleEditChange} className="w-full p-1 border rounded">
                          {todoStages.map(stage => <option key={stage} value={stage}>{stage}</option>)}
                        </select>
                      </td>
                      <td className="py-3 px-6">
                        <input type="text" name="task" value={editingItem.task} onChange={handleEditChange} className="w-full p-1 border rounded" />
                      </td>
                      <td className="py-3 px-6">
                        <input type="text" name="responsible" value={editingItem.responsible} onChange={handleEditChange} className="w-full p-1 border rounded" />
                      </td>
                      <td className="py-3 px-6">
                        <input type="date" name="dueDate" value={editingItem.dueDate} onChange={handleEditChange} className="w-full p-1 border rounded" />
                      </td>
                      <td className="py-3 px-6">
                        <select name="status" value={editingItem.status} onChange={handleEditChange} className="w-full p-1 border rounded">
                          {taskStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </td>
                      <td className="py-3 px-6">
                        <select name="priority" value={editingItem.priority} onChange={handleEditChange} className="w-full p-1 border rounded">
                          {priorities.map(priority => <option key={priority} value={priority}>{priority}</option>)}
                        </select>
                      </td>
                      <td className="py-3 px-6 text-center whitespace-nowrap">
                        <button onClick={handleUpdateItem} className="text-green-600 hover:text-green-800 font-semibold mr-2">Simpan</button>
                        <button onClick={() => setEditingItem(null)} className="text-gray-600 hover:text-gray-800 font-semibold">Batal</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 px-6">{item.stage}</td>
                      <td className="py-3 px-6">{item.task}</td>
                      <td className="py-3 px-6">{item.responsible}</td>
                      <td className="py-3 px-6">{formatDateForDisplay(item.dueDate)}</td>
                      <td className="py-3 px-6">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusClass(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-6">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getPriorityClass(item.priority)}`}>
                          {item.priority}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-center whitespace-nowrap">
                        <button onClick={() => handleEditClick(item)} className="text-blue-600 hover:text-blue-800 font-semibold mr-2" title="Edit">
                          Edit
                        </button>
                        <button onClick={() => handleDeleteClick(item.id)} className="text-red-600 hover:text-red-800 font-semibold" title="Hapus">
                          Hapus
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {todoItems.length === 0 && (
                <tr>
                  <td colSpan="7" className="py-4 px-6 text-center text-gray-500">Belum ada tugas yang tercatat.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const VendorsList = () => {
    const [newVendor, setNewVendor] = useState({
      category: budgetCategories[0], // Using budget categories for consistency
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      notes: ''
    });
    const [editingVendor, setEditingVendor] = useState(null);

    const handleNewVendorChange = (e) => {
      const { name, value } = e.target;
      setNewVendor(prev => ({ ...prev, [name]: value }));
    };

    const handleAddVendor = async () => {
      if (!newVendor.name || !newVendor.category) {
        showMessage('Nama vendor dan kategori harus diisi.');
        return;
      }
      await addVendor(newVendor);
      setNewVendor({
        category: budgetCategories[0],
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        notes: ''
      });
    };

    const handleEditClick = (vendor) => {
      setEditingVendor({ ...vendor });
    };

    const handleEditChange = (e) => {
      const { name, value } = e.target;
      setEditingVendor(prev => ({ ...prev, [name]: value }));
    };

    const handleUpdateVendor = async () => {
      if (!editingVendor || !editingVendor.name || !editingVendor.category) {
        showMessage('Nama vendor dan kategori harus diisi saat mengedit.');
        return;
      }
      await updateVendor(editingVendor.id, editingVendor);
      setEditingVendor(null);
    };

    const handleDeleteClick = (id) => {
      if (window.confirm('Apakah Anda yakin ingin menghapus vendor ini?')) {
        deleteVendor(id);
      }
    };

    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Daftar Vendor & Kontak Penting</h2>

        {message && (
          <div className="bg-green-100 text-green-700 p-3 rounded-md mb-4 text-center">
            {message}
          </div>
        )}

        <div className="mb-8 p-4 border border-blue-200 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-blue-800">Tambahkan Vendor Baru</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="vendorCategory" className="block text-sm font-medium text-gray-700">Kategori</label>
              <select name="category" id="vendorCategory" value={newVendor.category} onChange={handleNewVendorChange}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                {budgetCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="vendorName" className="block text-sm font-medium text-gray-700">Nama Vendor</label>
              <input type="text" name="name" id="vendorName" value={newVendor.name} onChange={handleNewVendorChange}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contoh: Catering Horas" />
            </div>
            <div>
              <label htmlFor="contactPerson" className="block text-sm font-medium text-gray-700">Nama Kontak Person</label>
              <input type="text" name="contactPerson" id="contactPerson" value={newVendor.contactPerson} onChange={handleNewVendorChange}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contoh: Bapak Hutagalung" />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Nomor Telepon</label>
              <input type="text" name="phone" id="phone" value={newVendor.phone} onChange={handleNewVendorChange}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contoh: 08123456789" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" name="email" id="email" value={newVendor.email} onChange={handleNewVendorChange}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contoh: info@vendor.com" />
            </div>
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">Alamat</label>
              <input type="text" name="address" id="address" value={newVendor.address} onChange={handleNewVendorChange}
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contoh: Jl. Merdeka No. 123" />
            </div>
            <div className="lg:col-span-3">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Catatan</label>
              <textarea name="notes" id="notes" value={newVendor.notes} onChange={handleNewVendorChange} rows="3"
                className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Tambahkan catatan penting tentang vendor ini"></textarea>
            </div>
          </div>
          <button onClick={handleAddVendor}
            className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out shadow-md">
            Tambah Vendor
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50 text-gray-600 uppercase text-sm leading-normal">
              <tr>
                <th className="py-3 px-6 text-left">Kategori</th>
                <th className="py-3 px-6 text-left">Nama Vendor</th>
                <th className="py-3 px-6 text-left">Kontak Person</th>
                <th className="py-3 px-6 text-left">Telepon</th>
                <th className="py-3 px-6 text-left">Email</th>
                <th className="py-3 px-6 text-left">Alamat</th>
                <th className="py-3 px-6 text-left">Catatan</th>
                <th className="py-3 px-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 text-sm">
              {vendors.map(vendor => (
                <tr key={vendor.id} className="border-b border-gray-200 hover:bg-gray-50">
                  {editingVendor && editingVendor.id === vendor.id ? (
                    <>
                      <td className="py-3 px-6">
                        <select name="category" value={editingVendor.category} onChange={handleEditChange} className="w-full p-1 border rounded">
                          {budgetCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </td>
                      <td className="py-3 px-6">
                        <input type="text" name="name" value={editingVendor.name} onChange={handleEditChange} className="w-full p-1 border rounded" />
                      </td>
                      <td className="py-3 px-6">
                        <input type="text" name="contactPerson" value={editingVendor.contactPerson} onChange={handleEditChange} className="w-full p-1 border rounded" />
                      </td>
                      <td className="py-3 px-6">
                        <input type="text" name="phone" value={editingVendor.phone} onChange={handleEditChange} className="w-full p-1 border rounded" />
                      </td>
                      <td className="py-3 px-6">
                        <input type="email" name="email" value={editingVendor.email} onChange={handleEditChange} className="w-full p-1 border rounded" />
                      </td>
                      <td className="py-3 px-6">
                        <input type="text" name="address" value={editingVendor.address} onChange={handleEditChange} className="w-full p-1 border rounded" />
                      </td>
                      <td className="py-3 px-6">
                        <textarea name="notes" value={editingVendor.notes} onChange={handleEditChange} rows="1" className="w-full p-1 border rounded"></textarea>
                      </td>
                      <td className="py-3 px-6 text-center whitespace-nowrap">
                        <button onClick={handleUpdateVendor} className="text-green-600 hover:text-green-800 font-semibold mr-2">Simpan</button>
                        <button onClick={() => setEditingVendor(null)} className="text-gray-600 hover:text-gray-800 font-semibold">Batal</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 px-6">{vendor.category}</td>
                      <td className="py-3 px-6">{vendor.name}</td>
                      <td className="py-3 px-6">{vendor.contactPerson}</td>
                      <td className="py-3 px-6">{vendor.phone}</td>
                      <td className="py-3 px-6">{vendor.email}</td>
                      <td className="py-3 px-6">{vendor.address}</td>
                      <td className="py-3 px-6 text-sm text-gray-500">{vendor.notes}</td>
                      <td className="py-3 px-6 text-center whitespace-nowrap">
                        <button onClick={() => handleEditClick(vendor)} className="text-blue-600 hover:text-blue-800 font-semibold mr-2" title="Edit">
                          Edit
                        </button>
                        <button onClick={() => handleDeleteClick(vendor.id)} className="text-red-600 hover:text-red-800 font-semibold" title="Hapus">
                          Hapus
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {vendors.length === 0 && (
                <tr>
                  <td colSpan="8" className="py-4 px-6 text-center text-gray-500">Belum ada vendor yang tercatat.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 font-sans text-gray-900">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          body {
            font-family: 'Inter', sans-serif;
          }
        `}
      </style>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-blue-700 mb-8 mt-4">
          Perencana Pernikahan Adat Batak Toba
        </h1>

        <nav className="flex justify-center mb-8 bg-white p-2 rounded-lg shadow-md">
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex items-center space-x-2 px-4 py-2 mx-1 rounded-md text-sm font-medium transition-colors duration-200
              ${activeTab === 'summary' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            <HomeIcon />
            <span>Ringkasan Anggaran</span>
          </button>
          <button
            onClick={() => setActiveTab('detailedBudget')}
            className={`flex items-center space-x-2 px-4 py-2 mx-1 rounded-md text-sm font-medium transition-colors duration-200
              ${activeTab === 'detailedBudget' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            <MoneyIcon />
            <span>Detail Anggaran</span>
          </button>
          <button
            onClick={() => setActiveTab('todo')}
            className={`flex items-center space-x-2 px-4 py-2 mx-1 rounded-md text-sm font-medium transition-colors duration-200
              ${activeTab === 'todo' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            <ListIcon />
            <span>Daftar Tugas</span>
          </button>
          <button
            onClick={() => setActiveTab('vendors')}
            className={`flex items-center space-x-2 px-4 py-2 mx-1 rounded-md text-sm font-medium transition-colors duration-200
              ${activeTab === 'vendors' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            <UsersIcon />
            <span>Vendor & Kontak</span>
          </button>
        </nav>

        <div className="content-area">
          {activeTab === 'summary' && <BudgetSummary />}
          {activeTab === 'detailedBudget' && <DetailedBudgetTracker />}
          {activeTab === 'todo' && <TodoList />}
          {activeTab === 'vendors' && <VendorsList />}
        </div>
      </div>
    </div>
  );
}

export default App;
