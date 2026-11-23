/* Plain-words help for a Python error: it reads the LAST line of a traceback (the one that names the error) and, using the
 * details in that line (the missing name, the key, the types), says what it most likely means and what to check.
 * No DOM, so it runs in the browser (window.PyErrorHints) and in Node (scripts/test_error_hints.js).
 *
 *   PyErrorHints.explain(tracebackText, "en" | "id")  ->  { line, tips: [string, ...] }  or null when the error is not recognised
 *
 * The first tip says what the error means; the next ones are things to check, in order of how often they are the cause.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PyErrorHints = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const c = (s) => "`" + s + "`";

  // [pattern for the error line (without any "E   " prefix), (match) => { en: [...], id: [...] }], first match wins
  const RULES = [
    // ---- indentation and syntax
    [/^IndentationError: expected an indented block/, () => ({
      en: ["A line that ends with a colon (`if`, `for`, `def`...) must be followed by at least one indented line.", "Indent the line under it by the same number of spaces as the other lines in that block (4 is the usual)."],
      id: ["Baris yang berakhir dengan titik dua (`if`, `for`, `def`...) harus diikuti sedikitnya satu baris yang menjorok.", "Jorokkan baris di bawahnya dengan jumlah spasi yang sama seperti baris lain di blok itu (biasanya 4)."] })],
    [/^IndentationError: unexpected indent/, () => ({
      en: ["This line is indented more than the line above it, but nothing opened a block.", "Remove the extra spaces, or add the `if`/`for`/`def` line that should come before it."],
      id: ["Baris ini menjorok lebih jauh daripada baris di atasnya, padahal tak ada yang membuka blok.", "Hapus spasi berlebih, atau tambahkan baris `if`/`for`/`def` yang seharusnya ada sebelumnya."] })],
    [/^IndentationError: unindent does not match/, () => ({
      en: ["This line's indentation matches none of the blocks above it.", "Line it up exactly with the block you mean, using spaces only (do not mix tabs and spaces)."],
      id: ["Indentasi baris ini tidak cocok dengan blok mana pun di atasnya.", "Sejajarkan persis dengan blok yang dimaksud, hanya dengan spasi (jangan campur tab dan spasi)."] })],
    [/^(?:IndentationError|TabError):/, () => ({
      en: ["The spaces at the start of a line do not line up.", "Align every line of a block with the same number of spaces, and do not mix tabs and spaces."],
      id: ["Spasi di awal baris tidak rata.", "Sejajarkan setiap baris dalam satu blok dengan jumlah spasi yang sama, dan jangan campur tab dan spasi."] })],
    [/^SyntaxError: '([\(\[\{])' was never closed/, (m) => ({
      en: ["You opened a " + c(m[1]) + " and never closed it.", "Look at the line named above and the lines just after it: every opening bracket needs its closing partner."],
      id: ["Anda membuka " + c(m[1]) + " tetapi tidak pernah menutupnya.", "Lihat baris yang disebut di atas dan baris-baris tepat sesudahnya: setiap kurung pembuka butuh pasangan penutupnya."] })],
    [/^SyntaxError: (?:unterminated string literal|unterminated triple-quoted)/, () => ({
      en: ["A piece of text starts with a quote but never ends with one.", "Add the matching closing quote (`\"` with `\"`, `'` with `'`) on the same line."],
      id: ["Sepotong teks diawali tanda kutip tetapi tidak pernah diakhiri.", "Tambahkan tanda kutip penutup yang sama (`\"` dengan `\"`, `'` dengan `'`) di baris yang sama."] })],
    [/^SyntaxError: expected ':'/, () => ({
      en: ["A colon is missing at the end of an `if`, `for`, `while`, `def` or `class` line.", "Add `:` at the end of that line."],
      id: ["Titik dua hilang di akhir baris `if`, `for`, `while`, `def`, atau `class`.", "Tambahkan `:` di akhir baris itu."] })],
    [/^SyntaxError: invalid syntax\. Perhaps you forgot a comma/, () => ({
      en: ["Two values sit next to each other with nothing between them.", "Put a comma between the items of a list, a dictionary or a function call."],
      id: ["Dua nilai berdampingan tanpa apa pun di antaranya.", "Taruh koma di antara item list, dictionary, atau pemanggilan fungsi."] })],
    [/^SyntaxError: (?:cannot assign to|invalid decimal literal|invalid non-printable)/, () => ({
      en: ["Python cannot read this line as written.", "Names cannot start with a digit or contain spaces or dashes, and a single `=` assigns while `==` compares."],
      id: ["Python tidak bisa membaca baris ini seperti yang tertulis.", "Nama tak boleh diawali angka atau memuat spasi atau tanda hubung, dan satu `=` menetapkan nilai sedangkan `==` membandingkan."] })],
    [/^SyntaxError:/, () => ({
      en: ["Python could not understand the shape of a line, usually at or just before the arrow `^` in the message.", "Check for a missing colon at the end of `if`/`for`/`def`, quotes that do not pair up, a bracket that was not closed, or a missing comma."],
      id: ["Python tidak bisa memahami bentuk sebuah baris, biasanya di atau tepat sebelum tanda panah `^` dalam pesan.", "Periksa titik dua yang hilang di akhir `if`/`for`/`def`, tanda kutip yang tidak berpasangan, kurung yang belum ditutup, atau koma yang hilang."] })],

    // ---- names
    [/^UnboundLocalError: .*['"]([^'"]+)['"]/, (m) => ({
      en: ["Inside a function, " + c(m[1]) + " is used before it has a value.", "Give it a value before this line, or pass it in as a parameter. A name you assign inside a function belongs to that function only."],
      id: ["Di dalam fungsi, " + c(m[1]) + " dipakai sebelum punya nilai.", "Beri nilai sebelum baris ini, atau teruskan sebagai parameter. Nama yang Anda isi di dalam fungsi hanya milik fungsi itu."] })],
    [/^NameError: name '([^']+)' is not defined/, (m) => ({
      en: ["Python does not know the name " + c(m[1]) + " at this line.", "Check the spelling and the capitals: " + c("Total") + " and " + c("total") + " are different names.", "Is the line that creates it above this one? And if it is meant to be text, it needs quotes."],
      id: ["Python tidak mengenal nama " + c(m[1]) + " pada baris ini.", "Periksa ejaan dan huruf besar-kecil: " + c("Total") + " dan " + c("total") + " adalah nama yang berbeda.", "Apakah baris yang membuatnya ada di atas baris ini? Dan jika maksudnya teks, ia perlu tanda kutip."] })],

    // ---- types
    [/^TypeError: can only concatenate str \(not "(\w+)"\) to str/, (m) => ({
      en: ["You are adding text and a " + m[1] + " with " + c("+") + ".", "Turn the other value into text with " + c("str(...)") + ", or turn the text into a number with " + c("int(...)") + " if you meant to add numbers."],
      id: ["Anda menjumlahkan teks dan " + m[1] + " dengan " + c("+") + ".", "Ubah nilai lainnya menjadi teks dengan " + c("str(...)") + ", atau ubah teksnya menjadi angka dengan " + c("int(...)") + " jika maksud Anda menjumlahkan angka."] })],
    [/^TypeError: unsupported operand type\(s\) for ([^:]+): '(\w+)' and '(\w+)'/, (m) => ({
      en: ["The operator " + c(m[1].trim()) + " does not work between a " + m[2] + " and a " + m[3] + ".", "Often one of them is text that should be a number (convert with " + c("int(...)") + "), or is " + c("None") + " because a function did not return a value."],
      id: ["Operator " + c(m[1].trim()) + " tidak bisa dipakai antara " + m[2] + " dan " + m[3] + ".", "Sering salah satunya adalah teks yang seharusnya angka (ubah dengan " + c("int(...)") + "), atau " + c("None") + " karena fungsi tidak mengembalikan nilai."] })],
    [/^TypeError: '(<|>|<=|>=)' not supported between instances of '(\w+)' and '(\w+)'/, (m) => ({
      en: ["You are comparing a " + m[2] + " with a " + m[3] + " using " + c(m[1]) + ".", "Convert one side so both are the same type, for example " + c("int(text) > 5") + " instead of " + c("text > 5") + "."],
      id: ["Anda membandingkan " + m[2] + " dengan " + m[3] + " memakai " + c(m[1]) + ".", "Ubah salah satu sisi agar keduanya bertipe sama, misalnya " + c("int(text) > 5") + " bukan " + c("text > 5") + "."] })],
    [/^TypeError: '?NoneType'? object (?:is not subscriptable|is not iterable|is not callable)/, () => ({
      en: ["A value is " + c("None") + " where Python expected a list, a dictionary or a function.", "The usual causes: a function that has no " + c("return") + " line, or a " + c(".get(...)") + " / search that found nothing."],
      id: ["Sebuah nilai adalah " + c("None") + " padahal Python mengharapkan list, dictionary, atau fungsi.", "Penyebab yang lazim: fungsi tanpa baris " + c("return") + ", atau " + c(".get(...)") + " / pencarian yang tidak menemukan apa-apa."] })],
    [/^TypeError: (\w+)\(\) takes (\d+) positional arguments? but (\d+) (?:was|were) given/, (m) => ({
      en: [c(m[1] + "()") + " expects " + m[2] + " argument(s) but got " + m[3] + ".", "Compare the call with the " + c("def") + " line: the number of values you pass must match its parameters (a method also counts " + c("self") + ")."],
      id: [c(m[1] + "()") + " mengharapkan " + m[2] + " argumen tetapi menerima " + m[3] + ".", "Bandingkan pemanggilan dengan baris " + c("def") + ": jumlah nilai yang Anda berikan harus sama dengan parameternya (method juga menghitung " + c("self") + ")."] })],
    [/^TypeError: (\w+)\(\) missing (\d+) required positional arguments?/, (m) => ({
      en: [c(m[1] + "()") + " was called without " + m[2] + " value(s) it needs.", "Look at the " + c("def") + " line and pass every parameter that has no default."],
      id: [c(m[1] + "()") + " dipanggil tanpa " + m[2] + " nilai yang dibutuhkannya.", "Lihat baris " + c("def") + " dan berikan setiap parameter yang tak punya nilai default."] })],
    [/^TypeError: '(\w+)' object is not callable/, (m) => ({
      en: ["You put " + c("(...)") + " after a " + m[1] + ", which is not a function.", "A variable may have the same name as a function (for example " + c("sum = 5") + " and later " + c("sum(...)") + "). Rename it."],
      id: ["Anda menaruh " + c("(...)") + " setelah " + m[1] + ", yang bukan fungsi.", "Sebuah variabel mungkin bernama sama dengan fungsi (misalnya " + c("sum = 5") + " lalu " + c("sum(...)") + "). Ganti namanya."] })],
    [/^TypeError: '(\w+)' object is not subscriptable/, (m) => ({
      en: ["You used square brackets " + c("[...]") + " on a " + m[1] + ", which cannot be indexed.", "Check that the value is a list, a dictionary or text, and not a number or a function (a function is called with " + c("(...)") + ")."],
      id: ["Anda memakai kurung siku " + c("[...]") + " pada " + m[1] + ", yang tak bisa diindeks.", "Pastikan nilainya list, dictionary, atau teks, bukan angka atau fungsi (fungsi dipanggil dengan " + c("(...)") + ")."] })],
    [/^TypeError: '(\w+)' object is not iterable/, (m) => ({
      en: ["A " + m[1] + " cannot be looped over.", "A " + c("for") + " loop needs a list, text, dictionary, set or range. To loop over a number, use " + c("range(n)") + "."],
      id: ["Sebuah " + m[1] + " tidak bisa diulangi.", "Loop " + c("for") + " butuh list, teks, dictionary, set, atau range. Untuk mengulang sebanyak angka, pakai " + c("range(n)") + "."] })],
    [/^TypeError: unhashable type: '(\w+)'/, (m) => ({
      en: ["A " + m[1] + " cannot be a dictionary key or a set member, because it can change.", "Use a tuple (round brackets) or a text/number instead."],
      id: ["Sebuah " + m[1] + " tidak bisa menjadi key dictionary atau anggota set, karena ia bisa berubah.", "Pakai tuple (kurung bulat) atau teks/angka sebagai gantinya."] })],
    [/^TypeError:/, () => ({
      en: ["A value has a type that this operation does not accept.", "Check what you pass to the function or operator with " + c("type(...)") + ", and compare it with what the function expects."],
      id: ["Sebuah nilai bertipe yang tidak diterima operasi ini.", "Periksa apa yang Anda berikan ke fungsi atau operator dengan " + c("type(...)") + ", lalu bandingkan dengan yang diharapkan fungsi."] })],

    // ---- values
    [/^ValueError: invalid literal for (int|float)\(\)[^:]*: ['"]?(.*?)['"]?$/, (m) => ({
      en: [c(m[1] + "()") + " cannot read " + c(m[2]) + " as a number.", "Text read from a file often has spaces, dots or a prefix such as " + c("Rp") + ": clean it first (" + c(".strip()") + ", " + c(".replace(\".\", \"\")") + "), or catch the error with " + c("try/except ValueError") + "."],
      id: [c(m[1] + "()") + " tidak bisa membaca " + c(m[2]) + " sebagai angka.", "Teks dari file sering berisi spasi, titik, atau awalan seperti " + c("Rp") + ": bersihkan dulu (" + c(".strip()") + ", " + c(".replace(\".\", \"\")") + "), atau tangkap errornya dengan " + c("try/except ValueError") + "."] })],
    [/^ValueError: not enough values to unpack/, () => ({
      en: ["You are splitting a value into more names than it has parts.", "Print the value first to see how many parts it really has (a line may be shorter than you expected)."],
      id: ["Anda memecah sebuah nilai menjadi lebih banyak nama daripada bagian yang dimilikinya.", "Cetak nilainya dulu untuk melihat berapa bagian sebenarnya (sebuah baris mungkin lebih pendek dari dugaan)."] })],
    [/^ValueError: too many values to unpack/, () => ({
      en: ["You are splitting a value into fewer names than it has parts.", "Print the value first to count its parts, then give a name to each (or use " + c("first, *rest = ...") + ")."],
      id: ["Anda memecah sebuah nilai menjadi lebih sedikit nama daripada bagian yang dimilikinya.", "Cetak nilainya dulu untuk menghitung bagiannya, lalu beri nama pada tiap bagian (atau pakai " + c("first, *rest = ...") + ")."] })],
    [/^ValueError: time data (.+) does not match format (.+)/, (m) => ({
      en: ["The date text " + m[1] + " does not look like the format " + m[2] + ".", "Compare them character by character (day first or month first? two-digit year? a time part?)."],
      id: ["Teks tanggal " + m[1] + " tidak tampak seperti format " + m[2] + ".", "Bandingkan karakter demi karakter (hari dulu atau bulan dulu? tahun dua digit? ada bagian waktu?)."] })],
    [/^ValueError: (?:list\.remove\(x\): x not in list|substring not found)/, () => ({
      en: ["You asked Python to find something that is not there.", "Test with " + c("if x in items:") + " first, or use " + c(".find(...)") + " (it returns -1 instead of raising an error)."],
      id: ["Anda meminta Python menemukan sesuatu yang tidak ada.", "Uji dulu dengan " + c("if x in items:") + ", atau pakai " + c(".find(...)") + " (ia mengembalikan -1, bukan error)."] })],
    [/^ValueError:/, () => ({
      en: ["The type is right, but the value is not acceptable for this operation (for example " + c("int(\"abc\")") + ").", "Print the value just before this line to see what it really is, and validate or clean it first."],
      id: ["Tipenya benar, tetapi nilainya tidak bisa diterima operasi ini (misalnya " + c("int(\"abc\")") + ").", "Cetak nilainya tepat sebelum baris ini untuk melihat isinya, lalu validasi atau bersihkan dulu."] })],

    // ---- lookups
    [/^KeyError: (.+)$/, (m) => ({
      en: ["The dictionary has no key " + c(m[1]) + ".", "Check the spelling, the capitals and stray spaces (" + c("'Status'") + ", " + c("'status'") + " and " + c("' status'") + " are three different keys). " + c("print(d.keys())") + " shows the real ones.", "If the key may be missing, use " + c("d.get(key, default)") + "."],
      id: ["Dictionary tidak punya key " + c(m[1]) + ".", "Periksa ejaan, huruf besar-kecil, dan spasi nyasar (" + c("'Status'") + ", " + c("'status'") + ", dan " + c("' status'") + " adalah tiga key berbeda). " + c("print(d.keys())") + " menampilkan key yang sebenarnya.", "Jika key mungkin tidak ada, pakai " + c("d.get(key, default)") + "."] })],
    [/^IndexError: pop from empty list/, () => ({
      en: ["You tried to take an item from an empty list.", "Check " + c("if items:") + " before " + c(".pop()") + "."],
      id: ["Anda mencoba mengambil item dari list kosong.", "Periksa " + c("if items:") + " sebelum " + c(".pop()") + "."] })],
    [/^IndexError:/, () => ({
      en: ["That position does not exist: positions start at 0 and the last one is " + c("len(items) - 1") + ".", "An empty list has no position 0 at all. Print " + c("len(items)") + " to check."],
      id: ["Posisi itu tidak ada: posisi dimulai dari 0 dan yang terakhir adalah " + c("len(items) - 1") + ".", "List kosong sama sekali tak punya posisi 0. Cetak " + c("len(items)") + " untuk memeriksa."] })],

    // ---- attributes
    [/^AttributeError: partially initialized module '(\w+)'/, (m) => ({
      en: ["Python loaded your own file instead of the library " + c(m[1]) + ", because your file has the same name.", "Rename your file so that it does not match a library (for example not " + c(m[1] + ".py") + ")."],
      id: ["Python memuat file Anda sendiri, bukan library " + c(m[1]) + ", karena nama file Anda sama.", "Ganti nama file Anda agar tak sama dengan library (misalnya jangan " + c(m[1] + ".py") + ")."] })],
    [/^AttributeError: module '(\w+)' has no attribute '(\w+)'/, (m) => ({
      en: ["The module " + c(m[1]) + " has nothing called " + c(m[2]) + ".", "Check the spelling and the capitals of the function name in the documentation."],
      id: ["Modul " + c(m[1]) + " tidak punya apa pun bernama " + c(m[2]) + ".", "Periksa ejaan dan huruf besar-kecil nama fungsi itu di dokumentasi."] })],
    [/^AttributeError: '?NoneType'? object has no attribute '(\w+)'/, (m) => ({
      en: ["A variable holds " + c("None") + " and you called " + c("." + m[1]) + " on it.", "The usual causes: a function that has no " + c("return") + " line, a " + c(".get(...)") + " that found nothing, or a search such as " + c("re.match") + " that did not match."],
      id: ["Sebuah variabel berisi " + c("None") + " dan Anda memanggil " + c("." + m[1]) + " padanya.", "Penyebab yang lazim: fungsi tanpa baris " + c("return") + ", " + c(".get(...)") + " yang tidak menemukan apa-apa, atau pencarian seperti " + c("re.match") + " yang tidak cocok."] })],
    [/^AttributeError: '(\w+)' object has no attribute '(\w+)'/, (m) => ({
      en: ["A " + m[1] + " has no " + c("." + m[2]) + ".", "The variable may hold a different type than you think (" + c("print(type(x))") + "), for example a number where you expected text, or a list where you expected one item."],
      id: ["Sebuah " + m[1] + " tidak punya " + c("." + m[2]) + ".", "Variabelnya mungkin berisi tipe yang berbeda dari dugaan Anda (" + c("print(type(x))") + "), misalnya angka padahal Anda mengira teks, atau list padahal Anda mengira satu item."] })],

    // ---- everything else that is common
    [/^ZeroDivisionError:/, () => ({
      en: ["Something was divided by zero.", "Guard it, for example " + c("if count == 0: return None") + ", before you divide."],
      id: ["Sesuatu dibagi dengan nol.", "Jaga dengan misalnya " + c("if count == 0: return None") + " sebelum membagi."] })],
    [/^FileNotFoundError: .*No such file or directory: ['"](.+)['"]/, (m) => ({
      en: ["There is no file called " + c(m[1]) + " where Python is looking.", "Check the spelling, and which folder you are running from (" + c("pwd") + " and " + c("ls") + " in the terminal). A path is relative to that folder."],
      id: ["Tidak ada file bernama " + c(m[1]) + " di tempat Python mencari.", "Periksa ejaan, dan dari folder mana Anda menjalankannya (" + c("pwd") + " dan " + c("ls") + " di terminal). Path itu relatif terhadap folder tersebut."] })],
    [/^PermissionError:/, () => ({
      en: ["The operating system does not allow this program to touch that file or folder.", "Check you are not opening a folder as if it were a file, and that the file is not locked by another program."],
      id: ["Sistem operasi tidak mengizinkan program ini menyentuh file atau folder itu.", "Pastikan Anda tidak membuka folder seolah-olah file, dan file itu tidak terkunci oleh program lain."] })],
    [/^(?:ModuleNotFoundError|ImportError): No module named '([^']+)'/, (m) => ({
      en: ["Python cannot find a library called " + c(m[1]) + ".", "Check the spelling. If it is a real library that is not in the browser's Python, run this one on your own computer, in your virtual environment, after " + c("pip install " + m[1].split(".")[0])  + "."],
      id: ["Python tidak menemukan library bernama " + c(m[1]) + ".", "Periksa ejaannya. Jika itu library sungguhan yang tidak ada di Python browser, jalankan di komputer Anda sendiri, di virtual environment, setelah " + c("pip install " + m[1].split(".")[0]) + "."] })],
    [/^ImportError: cannot import name '([^']+)'/, (m) => ({
      en: ["The module exists, but it has nothing called " + c(m[1]) + ".", "Check the spelling and the capitals of the name, and that you did not name your own file like the library."],
      id: ["Modulnya ada, tetapi tidak punya apa pun bernama " + c(m[1]) + ".", "Periksa ejaan dan huruf besar-kecil namanya, dan pastikan file Anda sendiri tidak bernama seperti library itu."] })],
    [/^RecursionError:/, () => ({
      en: ["A function kept calling itself and never stopped.", "Every recursive function needs a base case that returns without calling itself, and each call must work on something smaller."],
      id: ["Sebuah fungsi terus memanggil dirinya dan tidak pernah berhenti.", "Setiap fungsi rekursif butuh base case yang mengembalikan nilai tanpa memanggil dirinya, dan tiap panggilan harus bekerja pada sesuatu yang lebih kecil."] })],
    [/^AssertionError/, () => ({
      en: ["A check compared two values and they were different.", "Read the two values in the message: the one your code produced and the one it should have produced. Then print your value just before this line."],
      id: ["Sebuah pemeriksaan membandingkan dua nilai dan keduanya berbeda.", "Baca kedua nilai dalam pesan: yang dihasilkan kodemu dan yang seharusnya dihasilkan. Lalu cetak nilaimu tepat sebelum baris ini."] })]
  ];

  /** The line that names the error: the last one that looks like "SomethingError: ...", without pytest's "E   " prefix. */
  function lastErrorLine(text) {
    const lines = String(text || "").split("\n").map((s) => s.trim()).filter(Boolean);
    const named = [...lines].reverse().find((l) => /^(?:E\s+)?[A-Za-z_][\w.]*(?:Error|Exception|Exit)\b/.test(l));
    return (named || lines[lines.length - 1] || "").replace(/^E\s+/, "");
  }

  function explain(text, lang) {
    const line = lastErrorLine(text);
    if (!line) return null;
    for (const [re, build] of RULES) {
      const m = re.exec(line);
      if (!m) continue;
      const out = build(m);
      const tips = (lang === "id" ? out.id : out.en).slice(0, 3);
      return { line, tips };
    }
    return null;
  }

  return { explain, lastErrorLine, RULES };
});
