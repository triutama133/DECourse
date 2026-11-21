# Post-mortem: angka pendapatan salah

## Ringkasan
Pendapatan Gold di dashboard naik banyak dan direksi tidak senang. Sekarang sudah diperbaiki.

## Dampak
Cukup banyak dashboard menampilkan angka yang jauh lebih besar dari sebelumnya untuk sementara waktu.

## Kronologi
- Awal Januari: laporan diterbitkan.
- Pertengahan Januari: load malam berjalan.
- Belakangan: direksi menyadarinya.

## Akar masalah
Kesalahan manusia. Engineer yang menulis load pelanggan ceroboh dan memakai UPDATE alih-alih menyimpan riwayat. Ini salahnya.

## Deteksi
Direksi yang menemukannya.

## Tindak lanjut
- Lebih hati-hati dengan SQL ke depannya
- Tinjau ulang load-nya
