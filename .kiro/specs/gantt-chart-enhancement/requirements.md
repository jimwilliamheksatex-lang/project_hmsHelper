# Requirements Document

## Gantt Chart Enhancement — PPC Warping MES Workstation

---

## Introduction

Fitur ini merupakan enhancement besar pada sistem PPC Warping MES Workstation, yang mencakup dua sisi antarmuka yang saling terhubung:

1. **Sisi Planner** (`warping_ppc_planner.html`, sebelumnya `index.html`) — antarmuka penjadwalan produksi berbasis Gantt Chart untuk PPC (Production Planning & Control). Planner menyusun jadwal MO per mesin, mem-fix plan, dan memantau kondisi mesin secara realtime melalui sinyal IoT.

2. **Sisi Operator** (`operator_input.html`) — antarmuka per mesin untuk operator warping. Operator melihat MO yang telah di-assign oleh planner, mencatat hasil kerja per beam (kecepatan, panjang, grade, berat, cacat), dan melaporkan selesai MO sebagai HPH (Hasil Produksi Harian). MO berikutnya yang dikerjakan adalah urutan yang telah ditentukan planner.

Kedua halaman berbagi file `style.css` dan `app.js` yang sama (sebagian logika dipisah per modul), sehingga desain visual dan komponen dasar (badge, modal, tabel, form) konsisten di seluruh sistem. Koneksi antara planner dan operator dilakukan melalui JSON/API yang akan diintegrasikan di masa mendatang — saat ini menggunakan data dummy.

IoT yang terpasang di setiap mesin memiliki **3 tombol manual**: benang putus, mesin rusak, dan tidak ada order. Status **Running** berubah otomatis saat mesin bekerja. Sinyal IoT ini menjadi input realtime bagi planner untuk menyesuaikan jadwal secara dinamis.

Enhancement mencakup 15 area perubahan fungsional utama. Tujuan akhirnya adalah ekosistem perencanaan-eksekusi yang terhubung: planner membuat jadwal, operator mengerjakannya, dan IoT melaporkan kondisi mesin secara realtime.

---

## Glossary

- **Gantt Chart**: Visualisasi jadwal produksi berbasis timeline horizontal, menampilkan MO (Manufacturing Order) sebagai blok pada baris mesin.
- **MO (Manufacturing Order)**: Perintah produksi untuk satu proses warping, berisi nomor MO, jenis benang, jumlah beam, dan panjang target.
- **Planner**: Pengguna yang bertugas menjadwalkan MO ke mesin melalui antarmuka Gantt Chart.
- **Lapangan**: Tim operator produksi yang mengeksekusi jadwal yang telah di-fix oleh planner.
- **Mesin / Machine**: Unit warping yang direpresentasikan sebagai baris pada Gantt Chart (contoh: MC1, MC7, MC13, MC-SPLIT).
- **Blok MO**: Elemen visual persegi panjang pada Gantt Chart yang merepresentasikan sebuah MO terjadwal di suatu mesin.
- **Now Line**: Garis vertikal merah yang menandai posisi waktu saat ini pada Gantt Chart.
- **Creel**: Penyangga gulungan benang pada mesin warping. Penggantian creel membutuhkan waktu setup tambahan.
- **IoT**: Sistem sensor terhubung yang mengirimkan status mesin secara realtime (running / rusak).
- **Fix Plan**: Status jadwal yang telah disetujui planner dan siap dieksekusi oleh lapangan.
- **Zoom Level**: Lebar piksel per jam pada timeline Gantt Chart, menentukan seberapa detail atau lebar rentang waktu yang terlihat.
- **Gantt_Chart**: Komponen UI utama yang menampilkan timeline dan baris mesin.
- **Timeline_Header**: Baris paling atas Gantt Chart yang menampilkan label hari dan jam.
- **Table_Section**: Area tabel di bawah Gantt Chart yang menampilkan daftar MO Backlog belum terjadwal.
- **Snap_Ghost**: Elemen visual transparan yang muncul saat drag MO ke Gantt Chart, menunjukkan posisi drop yang akan dipilih.
- **Duration_Popup**: Modal pop-up yang muncul saat benang MO berbeda dengan benang aktif mesin, meminta planner memasukkan durasi penggantian benang.
- **Fix_Plan_Button**: Tombol yang mengubah status jadwal menjadi "fixed" sehingga siap dieksekusi.
- **Scheduler**: Subsistem JS yang mengelola state jadwal MO di Gantt Chart.
- **Renderer**: Subsistem JS yang menangani rendering ulang elemen visual (timeline header, blok MO, label mesin).
- **App**: Sistem keseluruhan aplikasi PPC Warping MES Workstation.
- **Operator_View**: Halaman `operator_input.html` — antarmuka per mesin untuk operator, menampilkan MO aktif yang di-assign planner dan form pencatatan hasil kerja per beam.
- **HPH (Hasil Produksi Harian)**: Laporan harian yang dihasilkan dari `operator_input.html`, merangkum seluruh beam yang telah diselesaikan operator dalam satu sesi MO, sebagai bukti penyelesaian pekerjaan.
- **Beam**: Gulungan benang hasil proses warping. Satu MO terdiri dari satu atau lebih beam dengan target panjang per beam yang telah ditentukan.
- **IoT Button**: Tombol fisik manual yang terpasang di mesin warping, mengirimkan salah satu dari 3 sinyal status: **benang putus**, **mesin rusak**, atau **tidak ada order**. Status **running** dikirim otomatis saat mesin aktif berputar.
- **IoT_Status**: Nilai status mesin yang diterima dari perangkat IoT: `running` (otomatis), `benang_putus`, `rusak`, atau `tidak_ada_order` (manual via tombol).
- **Job_Queue**: Antrian MO yang telah di-assign planner ke suatu mesin dan siap dieksekusi oleh operator secara berurutan.
- **Shared_CSS**: File `style.css` yang digunakan bersama oleh `warping_ppc_planner.html` dan `operator_input.html`.
- **Shared_JS**: File `app.js` yang digunakan bersama, dengan modul terpisah untuk logika planner dan logika operator.

---

## Requirements

---

### Requirement 1: Refactoring Arsitektur File

**User Story:** Sebagai developer, saya ingin memisahkan kode HTML, CSS, dan JavaScript ke dalam file terpisah, agar kode lebih mudah dipelihara dan dikembangkan.

#### Acceptance Criteria

1. THE App SHALL memisahkan seluruh konten CSS dari `index.html` ke dalam file `style.css` yang terpisah di direktori yang sama.
2. THE App SHALL memisahkan seluruh konten JavaScript dari `index.html` ke dalam file `app.js` yang terpisah di direktori yang sama.
3. THE App SHALL mempertahankan seluruh fungsionalitas yang ada setelah pemisahan file, tanpa perubahan perilaku yang dapat diobservasi.
4. WHEN `index.html` dimuat di browser, THE App SHALL memuat `style.css` dan `app.js` melalui tag `<link>` dan `<script>` yang sesuai.
5. THE App SHALL menggunakan pendekatan CSS Atomic/utility-first (kompatibel dengan Tailwind CSS jika diperlukan) sebagai dasar penulisan style baru di `style.css`.
6. IF file `style.css` atau `app.js` gagal dimuat saat `index.html` dimuat karena alasan apapun (file tidak ditemukan, error jaringan, masalah izin akses, atau kegagalan lainnya), THEN THE App SHALL menampilkan pesan error di console browser.

---

### Requirement 2: Timeline Zoom via Drag pada Header Jam

**User Story:** Sebagai planner, saya ingin bisa mengubah skala waktu Gantt Chart dengan cara drag pada header jam, agar saya bisa melihat jadwal lebih detail atau lebih ringkas sesuai kebutuhan.

#### Acceptance Criteria

1. WHEN planner menekan dan menahan tombol mouse pada area `Timeline_Header` jam (baris jam, bukan baris tanggal), THE Gantt_Chart SHALL mengaktifkan mode drag-to-zoom.
2. WHILE mode drag-to-zoom aktif, WHEN planner menggeser mouse ke kiri, THE Gantt_Chart SHALL mengurangi `Zoom Level` sebesar 1 piksel per jam untuk setiap 5 piksel pergerakan horizontal mouse; IF `Zoom Level` sudah berada di batas minimum, THE Gantt_Chart SHALL mempertahankan `Zoom Level` pada nilai minimum tanpa perubahan visual lebih lanjut.
3. WHILE mode drag-to-zoom aktif, WHEN planner menggeser mouse ke kanan, THE Gantt_Chart SHALL menambah `Zoom Level` sebesar 1 piksel per jam untuk setiap 5 piksel pergerakan horizontal mouse; IF `Zoom Level` sudah berada di batas maksimum, THE Gantt_Chart SHALL mempertahankan `Zoom Level` pada nilai maksimum tanpa perubahan visual lebih lanjut.
4. THE Gantt_Chart SHALL membatasi `Zoom Level` minimum pada 30 piksel per jam dan maksimum pada 300 piksel per jam.
5. WHEN `Zoom Level` berubah, THE Gantt_Chart SHALL merenderulang seluruh Blok MO sehingga lebar dan posisi piksel setiap blok menyesuaikan `Zoom Level` baru dalam satu render pass yang sama dengan pembaruan `Timeline_Header`.
6. WHEN `Zoom Level` berubah, THE Renderer SHALL memperbarui lebar setiap `hour-slot` pada `Timeline_Header` sesuai `Zoom Level` baru dalam satu render pass yang sama dengan pembaruan Blok MO.
7. WHEN planner melepaskan tombol mouse, THE Gantt_Chart SHALL menonaktifkan mode drag-to-zoom dan mempertahankan `Zoom Level` terakhir.
8. WHEN `Zoom Level` berubah akibat drag, THE Gantt_Chart SHALL mempertahankan titik waktu yang dipetakan ke piksel tengah viewport sebelum perubahan zoom tetap dipetakan ke piksel tengah viewport setelah perubahan zoom.

---

### Requirement 3: Garis Waktu Sekarang (Now Line) Realtime

**User Story:** Sebagai planner, saya ingin melihat garis merah yang menunjukkan waktu saat ini pada Gantt Chart, agar saya bisa mengetahui MO mana yang sudah berjalan dan mana yang belum.

#### Acceptance Criteria

1. THE Gantt_Chart SHALL menampilkan satu garis vertikal berwarna merah (`Now Line`) yang merentang dari baris pertama hingga baris terakhir mesin pada area timeline.
2. WHEN timer interval 60 detik terpicu, THE Renderer SHALL memperbarui posisi horizontal `Now Line` agar mencerminkan waktu saat ini.
3. WHEN `Zoom Level` berubah, THE Renderer SHALL memperbarui posisi piksel `Now Line` sesuai dengan `Zoom Level` baru.
4. THE Gantt_Chart SHALL menampilkan label waktu (format `HH:MM`) di bagian atas `Now Line` agar planner mengetahui jam sekarang secara langsung.
5. IF posisi akhir (end time) sebuah Blok MO berada di sebelah kiri `Now Line` atau tepat sama dengan posisi `Now Line` setelah setiap pembaruan posisi `Now Line`, THEN THE Scheduler SHALL menandai Blok MO tersebut sebagai **locked** sehingga tidak dapat di-drag atau dipindahkan.
5b. IF posisi akhir (end time) sebuah Blok MO yang sebelumnya **locked** bergerak kembali ke kanan `Now Line` (misalnya akibat perubahan zoom atau penyesuaian waktu), THEN THE Scheduler SHALL melepaskan status **locked** pada Blok MO tersebut.
6. WHILE sebuah Blok MO berstatus **locked**, WHEN status mesin yang bersangkutan berubah menjadi `"BREAKDOWN"` yang diterima dari IoT, THE Scheduler SHALL melepaskan status **locked** pada Blok MO tersebut sehingga dapat di-drag kembali.
7. IF planner mencoba men-drag Blok MO yang berstatus **locked** (tanpa kondisi mesin `"BREAKDOWN"`), THEN THE Gantt_Chart SHALL tidak memulai operasi drag, menampilkan kursor `not-allowed`, dan menampilkan tooltip yang menyatakan bahwa MO tidak dapat diubah karena sudah terlewati waktu saat ini.

---

### Requirement 4: Tombol "Fix Plan"

**User Story:** Sebagai planner, saya ingin menekan tombol "Fix Plan" setelah selesai menjadwalkan MO, agar status jadwal berubah menjadi final dan siap dieksekusi oleh lapangan.

#### Acceptance Criteria

1. THE Gantt_Chart SHALL menampilkan tombol berlabel **"Fix Plan"** pada area kontrol (control bar) yang selalu terlihat saat Gantt Chart ditampilkan.
2. WHEN tidak ada Blok MO berstatus `scheduled` di Gantt Chart, THE Gantt_Chart SHALL menampilkan tombol **Fix Plan** dalam kondisi **disabled** (visual abu-abu, tidak dapat diklik).
3. WHEN planner menekan tombol **Fix Plan**, THE Scheduler SHALL mengubah status semua Blok MO yang berstatus `scheduled` menjadi status `fixed`.
4. WHEN status Blok MO berubah menjadi `fixed`, THE Renderer SHALL memperbarui tampilan visual Blok MO tersebut sehingga warna isi dan teks label berbeda dari blok `scheduled` untuk membedakannya secara visual.
5. WHEN status Blok MO berubah menjadi `fixed`, THE Scheduler SHALL menandai Blok MO tersebut sebagai **locked** sehingga tidak dapat di-drag, di-resize, maupun dihapus melalui UI.
6. WHEN setidaknya satu Blok MO berstatus `fixed` ada di Gantt Chart, THE Gantt_Chart SHALL menampilkan indikator visual (contoh: badge atau teks di control bar) yang menyatakan "Plan Telah Di-Fix".
7. IF tidak ada Blok MO berstatus `scheduled` saat tombol **Fix Plan** ditekan (baik karena belum ada jadwal maupun semua jadwal sudah `fixed` sebelumnya), THEN THE App SHALL menampilkan notifikasi kepada planner bahwa tidak ada jadwal baru yang perlu di-fix.
8. IF sebagian Blok MO gagal berubah menjadi status `fixed` saat tombol **Fix Plan** ditekan, THEN THE App SHALL menampilkan notifikasi yang menyebutkan MO mana yang gagal di-fix, dan MO tersebut SHALL tetap berstatus `scheduled`.
9. WHEN semua Blok MO berstatus `scheduled` telah berubah menjadi `fixed`, THE Gantt_Chart SHALL menampilkan tombol **Fix Plan** kembali dalam kondisi **disabled**.

---

### Requirement 5: Pop-up Input Durasi Ganti Benang

**User Story:** Sebagai planner, saya ingin memasukkan durasi penggantian benang secara manual saat MO membutuhkan ganti benang, agar waktu setup yang direncanakan lebih akurat karena kondisi creel bisa berbeda-beda.

#### Acceptance Criteria

1. WHEN planner men-drop sebuah MO ke mesin yang benang aktifnya berbeda dengan benang MO tersebut, THE App SHALL menampilkan `Duration_Popup` alih-alih langsung menambahkan durasi setup default.
2. THE `Duration_Popup` SHALL menampilkan informasi: nama mesin target, benang aktif mesin, benang MO yang akan ditempatkan, dan field input numerik untuk durasi penggantian benang dalam satuan menit.
3. THE `Duration_Popup` SHALL menampilkan nilai default pada field input sebesar **45 menit** sebagai saran durasi penggantian.
4. WHEN planner mengisi field input dengan nilai valid (1–480 menit) dan menekan tombol konfirmasi pada `Duration_Popup`, THE Scheduler SHALL menempatkan Blok MO di timeline dengan blok setup tambahan selebar durasi yang dimasukkan planner (dalam menit) tepat sebelum blok MO utama.
5. IF planner mencoba menekan tombol konfirmasi sementara tombol batal juga dipicu secara bersamaan, THEN THE App SHALL memproses aksi batal dan membatalkan operasi drop tanpa menempatkan blok apapun.
6. WHEN planner menekan tombol batal pada `Duration_Popup`, THE App SHALL menutup `Duration_Popup` dan membatalkan operasi drop tanpa perubahan pada Gantt Chart.
7. IF planner memasukkan nilai durasi penggantian benang kurang dari 1 menit, lebih dari 480 menit, atau field kosong (tidak diisi), THEN THE `Duration_Popup` SHALL menampilkan pesan validasi yang menjelaskan rentang nilai valid dan tidak menutup popup hingga nilai valid dimasukkan.
8. WHEN `Duration_Popup` terbuka, THE App SHALL menonaktifkan interaksi drag & drop di luar popup.
9. WHEN planner menekan tombol ESC atau mengklik di luar area `Duration_Popup`, THE App SHALL menutup `Duration_Popup` dan membatalkan operasi drop tanpa perubahan pada Gantt Chart.

---

### Requirement 6: Drag MO Kembali ke Tabel (Un-schedule)

**User Story:** Sebagai planner, saya ingin menarik MO yang sudah dijadwalkan kembali ke tabel bawah, agar saya bisa membatalkan rencana dan menjadwalkan ulang dengan lebih fleksibel.

#### Acceptance Criteria

1. THE Gantt_Chart SHALL mengizinkan Blok MO yang berstatus `scheduled` untuk di-drag keluar dari area timeline.
2. WHEN planner men-drag Blok MO berstatus `scheduled` dan melepasnya di atas area `Table_Section`, THE Scheduler SHALL menghapus Blok MO tersebut dari Gantt Chart.
3. WHEN Blok MO dihapus dari Gantt Chart melalui operasi un-schedule, THE Scheduler SHALL secara atomik mengembalikan status MO yang bersangkutan ke `Ready` pada saat yang sama dengan penghapusan blok dari Gantt Chart, sehingga tidak ada celah waktu di mana MO tidak ada di Gantt maupun di tabel.
4. WHEN status MO berubah selama operasi un-schedule (apapun status akhirnya), THE Renderer SHALL memperbarui baris MO tersebut di `Table_Section` untuk mencerminkan status MO yang aktual.
5. WHEN planner mulai men-drag sebuah Blok MO, THE `Table_Section` SHALL menampilkan area drop visual (border atau background berbeda) yang terlihat membedakan area drop tersebut dari kondisi normal. WHEN planner melepaskan mouse atau drag dibatalkan, THE `Table_Section` SHALL menghilangkan area drop visual tersebut.
6. IF Blok MO yang dicoba di-drag untuk un-schedule berstatus `fixed` atau `running`, THEN THE Gantt_Chart SHALL tidak memulai operasi drag dan menampilkan kursor `not-allowed`.
7. IF planner men-drag Blok MO dan melepasnya di area yang bukan `Table_Section` maupun timeline (contoh: header, control bar), THEN THE App SHALL membatalkan operasi un-schedule, mengembalikan Blok MO ke posisi asalnya di timeline, dan tidak mengubah status MO.
8. IF operasi penghapusan Blok MO gagal secara atomik (misalnya karena kegagalan internal), THEN THE App SHALL melakukan rollback penuh: Blok MO dikembalikan ke posisi asalnya dengan status `scheduled`, dan THE App SHALL menampilkan pesan error kepada planner.

---

### Requirement 7: Kolom Resizable & Word-Wrap di Tabel Bawah

**User Story:** Sebagai planner, saya ingin bisa mengubah lebar kolom tabel dan membaca teks yang panjang tanpa terpotong, agar informasi MO bisa saya baca dengan lengkap.

#### Acceptance Criteria

1. THE `Table_Section` SHALL menampilkan handle (pemisah visual) di tepi kanan setiap header kolom dengan area interaktif minimal 6 piksel, yang memungkinkan planner mengubah lebar kolom dengan drag.
2. WHEN planner men-drag handle kolom ke kiri atau ke kanan, THE `Table_Section` SHALL mengubah lebar kolom tersebut dalam waktu tidak lebih dari 50ms per pergerakan pointer agar perubahan terasa responsif.
3. THE `Table_Section` SHALL membatasi lebar kolom minimum pada 40 piksel; WHEN drag mencapai batas 40 piksel, THE `Table_Section` SHALL menghentikan pengurangan lebar dan tidak melampaui nilai minimum tersebut.
4. THE `Table_Section` SHALL menerapkan `word-wrap` pada semua cell (`td`) agar teks yang melebihi lebar kolom dibungkus ke baris berikutnya, bukan terpotong atau overflow.
5. WHEN lebar kolom diubah, THE `Table_Section` SHALL mempertahankan nilai lebar kolom tersebut saat scroll atau filter ulang dilakukan; nilai lebar kolom SHALL direset ke default hanya saat tab browser ditutup atau halaman di-reload.
6. THE `Table_Section` SHALL menampilkan kursor `col-resize` saat pointer berada di atas handle kolom, terlepas dari nilai batas minimum lebar kolom yang dikonfigurasi.

---

### Requirement 8: MO Stok Belum Ready Dapat Masuk Gantt dengan Warning

**User Story:** Sebagai planner, saya ingin bisa menjadwalkan MO yang benangnya belum tersedia dengan tetap mendapat peringatan, agar saya bisa merencanakan lebih awal sambil mempertimbangkan kemungkinan benang tiba saat mesin masih berjalan.

#### Acceptance Criteria

1. THE `Table_Section` SHALL menampilkan MO dengan status stok `Not Ready` sebagai baris yang dapat di-drag (draggable), dengan ikon peringatan ⚠️ yang terlihat pada baris tersebut untuk membedakannya dari MO stok `Ready`.
2. WHEN planner men-drag MO berstatus stok `Not Ready` ke area Gantt Chart, THE Gantt_Chart SHALL mengizinkan operasi drag berlanjut tanpa memblokirnya.
3. WHEN planner men-drop MO berstatus stok `Not Ready` ke timeline mesin, THE App SHALL menampilkan modal peringatan yang menyatakan bahwa stok benang belum tersedia, sebelum mengeksekusi penempatan.
4. THE modal peringatan stok SHALL menampilkan nomor MO, nama benang, dan status stok `Not Ready` secara eksplisit.
5. WHEN planner menekan tombol konfirmasi pada modal peringatan stok, THE Scheduler SHALL menempatkan Blok MO di Gantt Chart dengan penanda visual berupa ikon ⚠️ yang terlihat pada Blok MO tersebut untuk membedakannya dari MO stok `Ready`.
6. WHEN planner menekan tombol batal pada modal peringatan stok, THE App SHALL membatalkan penempatan dan mengembalikan MO ke `Table_Section` tanpa perubahan pada Gantt Chart.
7. WHEN Blok MO stok `Not Ready` berhasil ditempatkan di Gantt Chart, THE Renderer SHALL menampilkan ikon peringatan ⚠️ pada Blok MO tersebut agar status stoknya selalu terlihat.
8. IF planner menutup modal peringatan stok tanpa menekan tombol konfirmasi (misalnya dengan menekan ESC atau mengklik di luar modal), THEN THE App SHALL membatalkan penempatan MO tanpa perubahan pada Gantt Chart.

---

### Requirement 9: Label Mesin yang Lebih Kecil dan Informatif

**User Story:** Sebagai planner, saya ingin kolom label mesin menampilkan informasi benang aktif, nomor MO berjalan, dan status mesin secara ringkas, agar saya bisa membaca kondisi setiap mesin tanpa harus scroll ke blok MO-nya.

#### Acceptance Criteria

1. THE Gantt_Chart SHALL menampilkan label mesin di kolom kiri dengan tiga baris informasi:
   - Baris 1: Nama mesin dengan penekanan tebal (bold), ukuran font normal.
   - Baris 2: Jenis benang & lot benang aktif dengan ukuran font lebih kecil dari baris 1, warna yang berbeda dari teks default (oranye).
   - Baris 3: Nomor MO yang sedang dikerjakan (MO dengan status `in_progress`) dengan ukuran font sama dengan baris 2, warna berbeda dari baris 2 (biru muda).
2. IF tidak ada MO dengan status `in_progress` yang sedang berjalan di mesin tersebut, THEN THE Gantt_Chart SHALL menampilkan teks "⏸️ Idle" pada baris 2 dan mengosongkan baris 3.
3. THE Gantt_Chart SHALL mengurutkan baris mesin berdasarkan nama mesin secara alfabetis (A–Z) dari atas ke bawah.
4. WHEN status mesin dari IoT adalah `running`, THE Gantt_Chart SHALL menampilkan indikator warna hijau yang terlihat jelas di sisi kiri label mesin.
5. WHEN status mesin dari IoT adalah `rusak`, THE Gantt_Chart SHALL menampilkan indikator warna merah tanpa animasi kedip di sisi kiri label mesin; THE Gantt_Chart SHALL hanya menampilkan indikator merah tersebut saat status mesin memang `rusak`, dan tidak pada status lainnya.
6. WHEN status mesin dari IoT bukan `running` dan bukan `rusak`, THE Gantt_Chart SHALL menampilkan indikator warna netral (abu-abu) di sisi kiri label mesin.
7. WHEN status mesin berubah (dari `running` ke `rusak` atau sebaliknya), THE Renderer SHALL memperbarui indikator warna label mesin yang bersangkutan tanpa reload halaman dalam waktu tidak lebih dari 5 detik. IF pembaruan indikator gagal dalam 5 detik, THEN THE App SHALL melakukan reload halaman sebagai fallback untuk memastikan status mesin ditampilkan dengan benar.

---

### Requirement 10: Header Timeline Realtime dengan Tanggal dan Jam

**User Story:** Sebagai planner, saya ingin header timeline menampilkan tanggal dan jam yang diperbarui secara realtime, agar saya selalu mengetahui posisi waktu saat ini tanpa harus melihat jam tangan atau perangkat lain.

#### Acceptance Criteria

1. THE `Timeline_Header` SHALL menampilkan label hari dan tanggal untuk setiap kolom hari pada baris pertama header.
2. THE `Timeline_Header` SHALL menampilkan label jam (format `HH:00`) untuk setiap kolom jam pada baris kedua header.
3. WHEN waktu sistem bertambah melewati menit ke-0 setiap jam baru, THE Renderer SHALL memperbarui label jam pada `Timeline_Header` yang mencerminkan hari ini agar tetap akurat.
4. THE `Timeline_Header` SHALL menampilkan label hari saat ini dengan setidaknya satu atribut visual yang berbeda secara terukur dari hari lainnya (font weight lebih tebal, warna background berbeda, atau border bawah yang berbeda).
5. THE `Timeline_Header` SHALL menampilkan waktu saat ini dalam format `HH:MM:SS` pada sudut kiri kolom mesin (sticky corner) yang diperbarui setiap detik.
6. WHEN waktu sistem bertambah setiap menit, THE Renderer SHALL memperbarui posisi `Now Line` dan label jam pada `Timeline_Header` dalam waktu tidak lebih dari 2 detik setelah transisi menit tersebut.
7. IF waktu sistem berubah lebih dari 30 detik secara tiba-tiba (penyesuaian manual atau clock drift correction), THEN THE Renderer SHALL mendeteksi perubahan dan memperbarui posisi `Now Line` serta header dalam waktu tidak lebih dari 5 detik.
8. WHEN halaman pertama kali dimuat sebelum interaksi pengguna, THE `Timeline_Header`, `Now Line`, dan jam di sticky corner SHALL menampilkan waktu sistem yang akurat.

---

### Requirement 11: Rename File Planner dan Struktur Penamaan

**User Story:** Sebagai developer, saya ingin file halaman planner menggunakan nama yang lebih deskriptif, agar struktur proyek lebih mudah dipahami dan konsisten dengan penamaan halaman operator.

#### Acceptance Criteria

1. THE App SHALL mengganti nama file `index.html` menjadi `warping_ppc_planner.html` sebagai halaman utama untuk planner.
2. THE App SHALL memastikan semua referensi internal (link, script src, stylesheet href) dalam `warping_ppc_planner.html` mengacu pada file yang benar setelah rename.
3. THE App SHALL mempertahankan seluruh fungsionalitas Gantt Chart yang ada setelah rename file, tanpa perubahan perilaku yang dapat diobservasi.
4. THE App SHALL menggunakan struktur direktori datar (semua file di direktori yang sama): `warping_ppc_planner.html`, `operator_input.html`, `style.css`, `app.js`.

---

### Requirement 12: Shared CSS dan JS untuk Planner dan Operator

**User Story:** Sebagai developer, saya ingin file `style.css` dan `app.js` dapat digunakan bersama oleh halaman planner dan halaman operator, agar desain visual konsisten dan tidak ada duplikasi kode.

#### Acceptance Criteria

1. THE App SHALL memindahkan seluruh CSS dari `operator_input.html` ke dalam `style.css` yang sama dengan yang digunakan `warping_ppc_planner.html`, menggunakan namespace atau prefix class yang tidak bentrok antara kedua halaman (contoh: `.planner-*` dan `.operator-*`).
2. THE App SHALL memindahkan seluruh JavaScript dari `operator_input.html` ke dalam `app.js` dengan struktur modular, sehingga logika planner dan logika operator tidak saling mengganggu.
3. WHEN `operator_input.html` dimuat di browser, THE App SHALL memuat `style.css` dan `app.js` melalui tag `<link>` dan `<script>` yang sesuai, sama seperti `warping_ppc_planner.html`.
4. THE App SHALL memastikan komponen visual yang digunakan di kedua halaman (badge status, modal peringatan, tombol aksi, form input, tabel data) menggunakan class dan style yang sama dari `style.css`.
5. THE App SHALL memastikan tidak ada konflik visual atau fungsional antara komponen planner dan operator saat kedua halaman dibuka secara bersamaan di browser yang berbeda.
6. IF `style.css` atau `app.js` diperbarui, THEN perubahan tersebut SHALL berlaku untuk kedua halaman sekaligus tanpa memerlukan modifikasi terpisah pada masing-masing file HTML.

---

### Requirement 13: Operator View — Antarmuka Job Order per Mesin

**User Story:** Sebagai operator mesin, saya ingin melihat MO aktif yang telah di-assign planner ke mesin saya, agar saya tahu apa yang harus dikerjakan dan dalam urutan apa, tanpa perlu berkomunikasi manual dengan planner.

#### Acceptance Criteria

1. THE `Operator_View` SHALL menampilkan informasi MO aktif yang sedang dikerjakan pada mesin tersebut, meliputi: nomor MO, jenis benang, target beam, panjang per beam, dan GB.
2. THE `Operator_View` SHALL menampilkan `Job_Queue` — daftar MO berikutnya yang telah di-assign planner ke mesin tersebut, dalam urutan yang ditentukan planner, sehingga operator mengetahui pekerjaan selanjutnya setelah MO aktif selesai.
3. WHEN operator menekan tombol **"Mulai Bekerja"**, THE `Operator_View` SHALL mencatat waktu mulai dan menampilkan form input per beam (beam number, speed, panjang akhir, grade, UA, winding, amplas, cacat).
4. WHEN operator mengisi form beam dan menekan **"Done - Add Beam"**, THE `Operator_View` SHALL memvalidasi input, menampilkan konfirmasi, dan menambahkan baris ke tabel HPH dengan waktu selesai, data beam, dan estimasi berat.
5. WHEN jumlah beam yang telah di-input sama dengan target beam pada MO, THE `Operator_View` SHALL menampilkan tombol **"Selesai - Lanjut ke MO Berikutnya"** dan menyembunyikan form input.
6. WHEN operator menekan **"Selesai - Lanjut ke MO Berikutnya"**, THE `Operator_View` SHALL menandai MO aktif sebagai selesai dan memuat MO berikutnya dari `Job_Queue` sebagai MO aktif yang baru.
7. IF `Job_Queue` kosong saat operator menekan "Selesai", THEN THE `Operator_View` SHALL menampilkan pesan bahwa tidak ada MO berikutnya yang di-assign dan mesin dalam kondisi menunggu jadwal baru dari planner.
8. THE `Operator_View` SHALL menampilkan estimasi sisa waktu pekerjaan berdasarkan speed mesin, total panjang target yang tersisa, dan panjang yang sudah selesai.

---

### Requirement 14: IoT Status — Integrasi Tombol Manual ke Sistem

**User Story:** Sebagai operator mesin, saya ingin menekan tombol IoT di mesin untuk melaporkan kondisi mesin secara realtime, agar planner dapat melihat status terkini dan menyesuaikan jadwal tanpa perlu komunikasi manual.

#### Acceptance Criteria

1. THE App SHALL mendukung 4 nilai `IoT_Status` untuk setiap mesin: `running` (otomatis saat mesin aktif), `benang_putus` (tombol manual), `rusak` (tombol manual), dan `tidak_ada_order` (tombol manual).
2. WHEN `IoT_Status` mesin berubah menjadi `benang_putus`, THE `Operator_View` SHALL menampilkan notifikasi visual yang jelas kepada operator bahwa status benang putus telah tercatat, dan THE Gantt_Chart SHALL memperbarui indikator status mesin tersebut dalam waktu tidak lebih dari 5 detik.
3. WHEN `IoT_Status` mesin berubah menjadi `rusak`, THE Gantt_Chart SHALL melepaskan status **locked** pada Blok MO di mesin tersebut sehingga planner dapat melakukan rerouting, dan THE `Operator_View` SHALL menampilkan notifikasi bahwa mesin dalam status rusak.
4. WHEN `IoT_Status` mesin berubah menjadi `tidak_ada_order`, THE Gantt_Chart SHALL menampilkan indikator visual abu-abu pada label mesin tersebut dan THE `Operator_View` SHALL menampilkan pesan bahwa mesin menunggu order baru dari planner.
5. WHEN `IoT_Status` mesin kembali menjadi `running` setelah sebelumnya `rusak` atau `benang_putus`, THE Gantt_Chart SHALL memperbarui indikator status mesin menjadi hijau dalam waktu tidak lebih dari 5 detik.
6. THE `Operator_View` SHALL menampilkan status IoT mesin saat ini (ikon dan label) secara prominan di bagian atas halaman, sehingga operator dan supervisor dapat melihatnya sekilas.
7. IF sinyal IoT tidak diterima lebih dari 30 detik (koneksi terputus), THEN THE App SHALL menampilkan indikator "IoT: OFFLINE" pada header kedua halaman (planner dan operator), dan THE Gantt_Chart SHALL mempertahankan status mesin terakhir yang diketahui.

---

### Requirement 15: HPH (Hasil Produksi Harian) — Pelaporan Penyelesaian MO

**User Story:** Sebagai supervisor lapangan, saya ingin melihat laporan HPH dari setiap operator per mesin, agar saya dapat memverifikasi bahwa MO yang di-assign planner telah diselesaikan dengan benar dan sesuai standar kualitas.

#### Acceptance Criteria

1. THE `Operator_View` SHALL menghasilkan HPH yang mencakup seluruh data beam yang telah diselesaikan dalam satu sesi MO: nomor beam, UI, speed, panjang akhir, winding, grade, UA, berat (kalkulasi otomatis), amplas, cacat, nama operator, dan shift.
2. THE `Operator_View` SHALL menghitung berat beam secara otomatis menggunakan formula: `berat = (denier × lembar × panjang_akhir) / 9.000.000` dan menampilkan hasilnya dalam satuan kg dengan 2 desimal.
3. THE `Operator_View` SHALL memvalidasi bahwa nomor beam yang diinput tidak duplikat dalam satu sesi MO yang sama; IF duplikat terdeteksi, THEN THE `Operator_View` SHALL menampilkan pesan error dan menolak penambahan baris.
4. THE `Operator_View` SHALL mengizinkan penghapusan baris beam dari tabel HPH hanya dengan autentikasi password admin, untuk mencegah manipulasi data oleh operator.
5. WHEN operator mengklik hapus pada baris beam, THE `Operator_View` SHALL meminta password admin; IF password benar, THEN baris dihapus dan beam dikembalikan ke daftar pilihan; IF salah, THEN baris tetap ada dan pesan error ditampilkan.
6. THE `Operator_View` SHALL menampilkan estimasi sisa pekerjaan yang diperbarui secara realtime setiap kali operator mengubah nilai speed atau panjang akhir, berdasarkan total target panjang MO dikurangi total panjang yang sudah selesai.
7. WHEN MO telah selesai (semua beam tercatat), THE `Operator_View` SHALL menampilkan ringkasan HPH yang dapat dicetak atau disimpan sebagai referensi lapangan.

---

## Catatan Teknis

- **Stack**: Vanilla HTML/CSS/JS (tanpa framework JavaScript).
- **File struktur**:
  - `warping_ppc_planner.html` — halaman planner (rename dari `index.html`)
  - `operator_input.html` — halaman operator per mesin
  - `style.css` — shared stylesheet untuk kedua halaman
  - `app.js` — shared script dengan modul terpisah: `Scheduler`, `Renderer`, `OperatorView`, `IoTHandler`
- **Data**: Saat ini menggunakan data hardcoded/dummy. Arsitektur harus dipersiapkan agar mudah diganti dengan panggilan API JSON di masa mendatang (fungsi data-fetching dipisah dari fungsi rendering).
- **IoT**: Saat ini disimulasikan dengan tombol di control bar. Arsitektur harus memudahkan penggantian dengan WebSocket atau polling API di masa mendatang.
- **CSS**: Gunakan CSS custom properties (variabel) yang sudah ada; tambahkan utility class baru sesuai kebutuhan. Gunakan prefix namespace `.planner-` dan `.operator-` untuk class yang spesifik ke masing-masing halaman, gunakan class umum tanpa prefix untuk komponen shared.
- **CSS approach**: Atomic/utility-first CSS dengan CSS custom properties. Tailwind CDN dapat digunakan untuk kelas utilitas tambahan.
- **Kompatibilitas**: Aplikasi dijalankan di browser modern (Chromium-based) di lingkungan workstation pabrik untuk planner, dan tablet/monitor di lantai produksi untuk operator.
- **Path workspace**: `h:\Heksatex\HMS\project_hmsHelper\`
