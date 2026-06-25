import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/lib/api';
import { Receipt, Eye, EyeOff, Mail, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer for resend button
  useEffect(() => {
    if (cooldown > 0) {
      timerRef.current = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [cooldown > 0]);

  const handleSendCode = async () => {
    if (!email.trim()) {
      setError('请输入邮箱地址');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('邮箱格式不正确');
      return;
    }

    setError('');
    setSendingCode(true);
    try {
      await authApi.sendCode(email.trim());
      setCodeSent(true);
      setCooldown(60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('请填写用户名和密码');
      return;
    }
    if (isRegister) {
      if (password.length < 6) {
        setError('密码至少6位');
        return;
      }
      if (!email.trim()) {
        setError('请输入邮箱地址');
        return;
      }
      if (!code.trim()) {
        setError('请输入验证码');
        return;
      }
    }

    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await register(username.trim(), password, email.trim(), code.trim(), nickname.trim() || undefined);
      } else {
        await login(username.trim(), password);
      }
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegister(!isRegister);
    setError('');
    setCodeSent(false);
    setCooldown(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-8 text-center animate-fade-in">
        <div className="w-20 h-20 bg-white/15 backdrop-blur-sm rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
          <Receipt size={40} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">小票收纳小管家</h1>
        <p className="text-primary-200 text-sm mt-1">轻松管理每一笔消费</p>
      </div>

      {/* Form Card */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 animate-slide-up"
      >
        <h2 className="text-xl font-bold text-slate-900 mb-6">
          {isRegister ? '创建账号' : '欢迎回来'}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field"
              placeholder="请输入用户名"
              autoComplete="username"
            />
          </div>

          {isRegister && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">邮箱</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setCodeSent(false); }}
                    className="input-field pl-11"
                    placeholder="用于接收验证码"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">验证码</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="input-field flex-1 text-center tracking-widest text-lg"
                    placeholder="6 位数字"
                    maxLength={6}
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={sendingCode || cooldown > 0 || !email.trim()}
                    className="btn-secondary whitespace-nowrap px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingCode ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : cooldown > 0 ? (
                      `${cooldown}s`
                    ) : codeSent ? (
                      '重新发送'
                    ) : (
                      '发送验证码'
                    )}
                  </button>
                </div>
                {codeSent && (
                  <p className="text-xs text-emerald-500 mt-1.5">验证码已发送至 {email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">昵称（可选）</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="input-field"
                  placeholder="给自己取个名字"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">密码</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pr-12"
                placeholder={isRegister ? '至少6位密码' : '请输入密码'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 p-1"
              >
                {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full mt-6 py-3 text-base"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              处理中...
            </span>
          ) : isRegister ? '注册' : '登录'}
        </button>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={switchMode}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
          </button>
        </div>
      </form>
    </div>
  );
}
