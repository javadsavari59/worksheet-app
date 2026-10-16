import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import CryptoJS from 'crypto-js';

const sha256 = (m) => CryptoJS.SHA256(m).toString();

const fmtTime = (sec) => {
  if (sec == null) return '-';
  return `${Math.floor(sec / 60)} دقیقه و ${sec % 60} ثانیه`;
};

export default function App() {
  const [role, setRole] = useState('select');
  if (role === 'student') return <StudentApp onExit={() => setRole('select')} />;
  if (role === 'teacher') return <TeacherApp onExit={() => setRole('select')} />;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-100">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">سامانه کاربرگ تعاملی</h1>
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <button onClick={() => setRole('student')} className="flex-1 bg-blue-600 text-white px-6 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg">ورود دانش‌آموز</button>
        <button onClick={() => setRole('teacher')} className="flex-1 bg-purple-600 text-white px-6 py-4 rounded-xl font-bold text-lg hover:bg-purple-700 shadow-lg">ورود معلم</button>
      </div>
    </div>
  );
}

/* ================= دانش‌آموز ================= */
function StudentApp({ onExit }) {
  const [step, setStep] = useState('login');
  const [code, setCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [worksheets, setWorksheets] = useState([]);
  const [worksheet, setWorksheet] = useState(null);
  const [answers, setAnswers] = useState({});
  const [startTime, setStartTime] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { data, error: err } = await supabase.rpc('check_student', { p_code: code.trim() });
    setLoading(false);
    if (err || !data || data.length === 0) { setError('کد دانش‌آموزی یافت نشد.'); return; }
    setStudentName(data[0].name);
    const { data: ws } = await supabase.from('worksheets').select('id,title,description,time_limit').eq('is_active', true).order('created_at', { ascending: false });
    setWorksheets(ws || []);
    setStep('list');
  };

  const openWorksheet = async (id) => {
    setLoading(true); setError('');
    const { data: ws } = await supabase.from('worksheets').select('*').eq('id', id).single();
    const { data: existing } = await supabase.rpc('get_student_submission', { p_code: code.trim(), p_worksheet_id: id });
    setLoading(false);
    setWorksheet(ws);
    if (existing && existing.length > 0) {
      setSubmission(existing[0]);
      setStep('result');
    } else {
      setAnswers({});
      setStartTime(Date.now());
      setStep('solve');
    }
  };

  const setAnswer = (qid, val) => setAnswers(p => ({ ...p, [qid]: val }));

  const isCorrect = (q, ans) => {
    if (q.type === 'multiple_choice' && ans !== undefined && ans !== null)
      return sha256(String(q.options[ans]).trim().toLowerCase()) === q.correct_hash;
    if (q.type === 'short_answer' && ans)
      return sha256(String(ans).trim().toLowerCase()) === q.correct_hash;
    return false;
  };

  const submit = async () => {
    setLoading(true); setError('');
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    let auto = 0;
    for (const q of worksheet.content.questions) {
      if (q.requires_manual_grading) continue;
      if (isCorrect(q, answers[q.id])) auto += q.points;
    }
    const { error: err } = await supabase.from('submissions').insert({
      worksheet_id: worksheet.id,
      student_code: code.trim(),
      answers,
      auto_score: auto,
      final_score: auto,
      time_spent: timeSpent,
    });
    if (err) { setLoading(false); setError('خطا در ثبت پاسخ: ' + err.message); return; }
    const { data } = await supabase.rpc('get_student_submission', { p_code: code.trim(), p_worksheet_id: worksheet.id });
    setLoading(false);
    setSubmission(data && data[0]);
    setStep('result');
  };

  if (step === 'login') return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100">
      <form onSubmit={login} className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-blue-600 mb-2">سامانه کاربرگ تعاملی</h1>
        <p className="text-gray-500 text-center mb-6">کد دانش‌آموزی خود را وارد کنید</p>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="مثال: S001" dir="ltr"
          className="w-full p-3 border rounded-lg text-center text-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        <button disabled={loading} className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'در حال بررسی...' : 'ورود'}
        </button>
        <button type="button" onClick={onExit} className="w-full mt-3 text-sm text-gray-500">بازگشت</button>
      </form>
    </div>
  );

  if (step === 'list') return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">سلام {studentName} 👋</h2>
          <button onClick={onExit} className="text-sm bg-gray-200 px-4 py-2 rounded-lg">خروج</button>
        </div>
        <h3 className="font-bold text-gray-700 mb-3">کاربرگ‌های فعال:</h3>
        <div className="space-y-3">
          {worksheets.map(ws => (
            <button key={ws.id} onClick={() => openWorksheet(ws.id)} disabled={loading}
              className="w-full text-right bg-white p-5 rounded-xl shadow-sm border hover:shadow-md transition">
              <p className="font-bold text-gray-800">{ws.title}</p>
              <p className="text-sm text-gray-500 mt-1">{ws.description}</p>
              {ws.time_limit && <p className="text-xs text-orange-600 mt-2">⏱ محدودیت: {ws.time_limit} دقیقه</p>}
            </button>
          ))}
          {worksheets.length === 0 && <p className="text-gray-500">کاربرگ فعالی وجود ندارد.</p>}
        </div>
      </div>
    </div>
  );

  if (step === 'solve' && worksheet) return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white p-4 rounded-xl shadow-sm mb-4 sticky top-0 z-10 border-b">
          <h2 className="text-xl font-bold text-gray-800">{worksheet.title}</h2>
        </div>
        <div className="space-y-4">
          {worksheet.content.questions.map((q, i) => (
            <div key={q.id} className="bg-white p-5 rounded-xl shadow-sm border">
              <div className="flex items-start gap-3 mb-4">
                <span className="bg-blue-100 text-blue-700 w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm shrink-0">{i + 1}</span>
                <p className="text-gray-800 font-medium leading-relaxed">{q.text}</p>
              </div>
              {q.type === 'multiple_choice' && (
                <div className="space-y-2 mr-11">
                  {q.options.map((opt, oi) => (
                    <label key={oi} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-blue-50">
                      <input type="radio" name={q.id} checked={answers[q.id] === oi} onChange={() => setAnswer(q.id, oi)} className="w-5 h-5" />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.type === 'short_answer' && (
                <input type="text" value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)}
                  placeholder="پاسخ..." className="mr-11 w-[calc(100%-2.75rem)] p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              )}
              {q.type === 'essay' && (
                <div className="mr-11">
                  <textarea value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)} rows="4"
                    placeholder="پاسخ تشریحی..." className="w-full p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  <p className="text-xs text-orange-600 mt-1">⚠️ نیاز به تصحیح معلم</p>
                </div>
              )}
            </div>
          ))}
        </div>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg mt-4 text-center">{error}</div>}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
          <button onClick={submit} disabled={loading}
            className="w-full max-w-2xl mx-auto block bg-green-600 text-white p-4 rounded-xl font-bold text-lg hover:bg-green-700 disabled:opacity-50">
            {loading ? 'در حال ثبت...' : 'پایان و ثبت پاسخ‌ها'}
          </button>
        </div>
      </div>
    </div>
  );

  if (step === 'result' && submission && worksheet) return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white p-6 rounded-2xl shadow-lg text-center mb-4">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl">✓</div>
          <h2 className="text-xl font-bold mb-2">پاسخ‌های شما ثبت شد</h2>
          <p className="text-4xl font-bold text-blue-700 my-3">{submission.final_score ?? submission.auto_score}</p>
          <p className="text-sm text-gray-500">زمان: {fmtTime(submission.time_spent)}</p>
        </div>
        <div className="space-y-3 mb-4">
          {worksheet.content.questions.map((q, i) => {
            const ans = submission.answers[q.id];
            const ok = isCorrect(q, ans);
            return (
              <div key={q.id} className={`p-4 rounded-xl border ${q.requires_manual_grading ? 'bg-yellow-50 border-yellow-200' : ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <p className="font-medium text-gray-800 mb-1">{i + 1}. {q.text}</p>
                <p className="text-sm text-gray-600">
                  پاسخ شما: {ans !== undefined && ans !== null ? (q.type === 'multiple_choice' ? q.options[ans] : ans) : 'بدون پاسخ'}
                </p>
                {q.requires_manual_grading
                  ? <p className="text-xs text-yellow-700 mt-1">در انتظار تصحیح معلم</p>
                  : <>
                      <p className={`text-xs mt-1 ${ok ? 'text-green-700' : 'text-red-700'}`}>{ok ? '✅ صحیح' : '❌ نادرست'}</p>
                      {!ok && q.explanation && <p className="text-xs text-gray-600 mt-1">💡 {q.explanation}</p>}
                    </>}
              </div>
            );
          })}
        </div>
        {submission.feedback && (
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl mb-4">
            <p className="font-bold text-yellow-800 mb-1">💬 بازخورد معلم:</p>
            <p className="text-gray-800">{submission.feedback}</p>
          </div>
        )}
        <button onClick={onExit} className="w-full bg-gray-200 p-3 rounded-lg font-bold hover:bg-gray-300">بازگشت</button>
      </div>
    </div>
  );

  return null;
}

/* ================= معلم ================= */
function TeacherApp({ onExit }) {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [manualScore, setManualScore] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) { setAuthed(true); load(); } });
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('submissions')
      .select('*, students(name), worksheets(title)')
      .order('submitted_at', { ascending: false });
    setSubmissions(data || []);
    setLoading(false);
  };

  const login = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) { setError('ورود ناموفق: ' + err.message); return; }
    setAuthed(true); load();
  };

  const openReview = async (sub) => {
    setLoading(true);
    const { data: ws } = await supabase.from('worksheets').select('content').eq('id', sub.worksheet_id).single();
    setLoading(false);
    setSelected({ sub, questions: ws.content.questions });
    setManualScore(sub.manual_score || 0);
    setFeedback(sub.feedback || '');
  };

  const save = async () => {
    setLoading(true);
    const manual = Number(manualScore) || 0;
    const { error: err } = await supabase.from('submissions')
      .update({ manual_score: manual, feedback, final_score: (selected.sub.auto_score || 0) + manual })
      .eq('id', selected.sub.id);
    setLoading(false);
    if (err) { alert('خطا: ' + err.message); return; }
    setSelected(null); load();
  };

  const logout = async () => { await supabase.auth.signOut(); setAuthed(false); setSubmissions([]); };

  if (!authed) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100">
      <form onSubmit={login} className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-purple-600 mb-6">ورود معلم</h1>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ایمیل" dir="ltr"
          className="w-full p-3 border rounded-lg mb-3 focus:ring-2 focus:ring-purple-500 focus:outline-none" />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="رمز عبور" dir="ltr"
          className="w-full p-3 border rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 focus:outline-none" />
        <button disabled={loading} className="w-full bg-purple-600 text-white p-3 rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50">
          {loading ? 'در حال ورود...' : 'ورود'}
        </button>
        <button type="button" onClick={onExit} className="w-full mt-3 text-sm text-gray-500">بازگشت</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">پنل معلم</h2>
          <div className="flex gap-2">
            <button onClick={load} className="text-sm bg-gray-200 px-4 py-2 rounded-lg">بروزرسانی</button>
            <button onClick={logout} className="text-sm bg-red-100 text-red-700 px-4 py-2 rounded-lg">خروج</button>
          </div>
        </div>

        {!selected ? (
          <div className="md:hidden space-y-4">
            {submissions.map(sub => (
              <div key={sub.id} className="bg-white p-4 rounded-xl shadow border">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold">{sub.students?.name}</p>
                    <p className="text-xs text-gray-500">{sub.student_code} • {sub.worksheets?.title}</p>
                  </div>
                  <button onClick={() => openReview(sub)} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold">تصحیح</button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-blue-50 p-2 rounded"><p className="text-xs text-blue-600">خودکار</p><p className="font-bold text-blue-700">{sub.auto_score ?? 0}</p></div>
                  <div className="bg-orange-50 p-2 rounded"><p className="text-xs text-orange-600">دستی</p><p className="font-bold text-orange-700">{sub.manual_score ?? 0}</p></div>
                  <div className="bg-green-50 p-2 rounded"><p className="text-xs text-green-600">نهایی</p><p className="font-bold text-green-700">{sub.final_score ?? 0}</p></div>
                </div>
              </div>
            ))}
            {submissions.length === 0 && <p className="text-gray-500 text-center">هنوز پاسخی ثبت نشده.</p>}
          </div>
        ) : (
          <div className="bg-white p-6 rounded-xl shadow-lg border">
            <div className="flex justify-between items-center mb-4 border-b pb-4">
              <h3 className="text-xl font-bold">تصحیح: {selected.sub.students?.name}</h3>
              <button onClick={() => setSelected(null)} className="text-red-500 text-2xl">×</button>
            </div>
            <div className="space-y-3 mb-6 max-h-96 overflow-y-auto p-2 bg-gray-50 rounded-lg">
              {selected.questions.map((q, i) => {
                const ans = selected.sub.answers[q.id];
                return (
                  <div key={q.id} className="bg-white p-4 rounded border">
                    <p className="text-sm text-gray-500 mb-1">{i + 1}. {q.text}</p>
                    <p className="font-medium">پاسخ: {ans !== undefined && ans !== null ? (q.type === 'multiple_choice' ? q.options[ans] : ans) : 'بدون پاسخ'}</p>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">نمره دستی</label>
                <input type="number" step="0.5" value={manualScore} onChange={e => setManualScore(e.target.value)}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">بازخورد</label>
                <input type="text" value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="بازخورد برای دانش‌آموز"
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              </div>
            </div>
            <button onClick={save} disabled={loading} className="w-full bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50">
              {loading ? 'در حال ذخیره...' : 'ذخیره نمره و بازخورد'}
            </button>
          </div>
        )}

        {selected === null && (
          <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-right">
              <thead className="bg-gray-100 text-gray-700">
                <tr><th className="p-4">دانش‌آموز</th><th className="p-4">کاربرگ</th><th className="p-4">خودکار</th><th className="p-4">دستی</th><th className="p-4">نهایی</th><th className="p-4">عملیات</th></tr>
              </thead>
              <tbody className="divide-y">
                {submissions.map(sub => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium">{sub.students?.name} <span className="text-xs text-gray-500">({sub.student_code})</span></td>
                    <td className="p-4 text-sm">{sub.worksheets?.title}</td>
                    <td className="p-4 text-blue-600 font-bold">{sub.auto_score ?? 0}</td>
                    <td className="p-4 text-orange-600 font-bold">{sub.manual_score ?? 0}</td>
                    <td className="p-4 text-green-600 font-bold">{sub.final_score ?? 0}</td>
                    <td className="p-4"><button onClick={() => openReview(sub)} className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-sm">تصحیح</button></td>
                  </tr>
                ))}
                {submissions.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-gray-500">هنوز پاسخی ثبت نشده.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}