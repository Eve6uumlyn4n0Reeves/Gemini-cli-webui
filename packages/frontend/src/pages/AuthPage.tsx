import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/stores/useAuthStore'
import { useToast } from '@/hooks/useToast'
import { cn, CONSTANTS } from '@/lib/utils'

const loginSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
})

const registerSchema = z.object({
  username: z.string().min(3, '用户名至少3个字符').max(50, '用户名最多50个字符'),
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少6个字符').max(100, '密码最多100个字符'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword'],
})

type LoginForm = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const { login, register, isLoading, error, clearError } = useAuthStore()
  const { toast } = useToast()

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  })

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const onLoginSubmit = async (data: LoginForm) => {
    clearError()
    const success = await login(data)
    
    if (success) {
      toast({
        title: '登录成功',
        description: '欢迎回来！',
        variant: 'success',
      })
    } else {
      toast({
        title: '登录失败',
        description: error || '用户名或密码错误',
        variant: 'destructive',
      })
    }
  }

  const onRegisterSubmit = async (data: RegisterForm) => {
    clearError()
    const success = await register({
      username: data.username,
      email: data.email,
      password: data.password,
    })
    
    if (success) {
      toast({
        title: '注册成功',
        description: '欢迎使用 Gemini CLI WebUI！',
        variant: 'success',
      })
    } else {
      toast({
        title: '注册失败',
        description: error || '注册失败，请稍后重试',
        variant: 'destructive',
      })
    }
  }

  const switchMode = () => {
    setIsLogin(!isLogin)
    clearError()
    loginForm.reset()
    registerForm.reset()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          {/* Logo */}
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg">
              <span className="text-2xl font-bold">G</span>
            </div>
          </div>
          
          <div>
            <CardTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {CONSTANTS.APP_NAME}
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              {isLogin ? '登录到您的账户' : '创建新账户'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {isLogin ? (
            /* Login Form */
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  用户名
                </label>
                <Input
                  id="username"
                  type="text"
                  placeholder="请输入用户名"
                  autoComplete="username"
                  disabled={isLoading}
                  {...loginForm.register('username')}
                  className={cn(
                    loginForm.formState.errors.username && 'border-red-500 focus:border-red-500'
                  )}
                />
                {loginForm.formState.errors.username && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {loginForm.formState.errors.username.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  密码
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码"
                    autoComplete="current-password"
                    disabled={isLoading}
                    {...loginForm.register('password')}
                    className={cn(
                      'pr-10',
                      loginForm.formState.errors.password && 'border-red-500 focus:border-red-500'
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-slate-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-slate-400" />
                    )}
                  </Button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {loginForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                登录
              </Button>
            </form>
          ) : (
            /* Register Form */
            <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="reg-username" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  用户名
                </label>
                <Input
                  id="reg-username"
                  type="text"
                  placeholder="请输入用户名"
                  autoComplete="username"
                  disabled={isLoading}
                  {...registerForm.register('username')}
                  className={cn(
                    registerForm.formState.errors.username && 'border-red-500 focus:border-red-500'
                  )}
                />
                {registerForm.formState.errors.username && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {registerForm.formState.errors.username.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  邮箱
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="请输入邮箱地址"
                  autoComplete="email"
                  disabled={isLoading}
                  {...registerForm.register('email')}
                  className={cn(
                    registerForm.formState.errors.email && 'border-red-500 focus:border-red-500'
                  )}
                />
                {registerForm.formState.errors.email && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {registerForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="reg-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  密码
                </label>
                <div className="relative">
                  <Input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码"
                    autoComplete="new-password"
                    disabled={isLoading}
                    {...registerForm.register('password')}
                    className={cn(
                      'pr-10',
                      registerForm.formState.errors.password && 'border-red-500 focus:border-red-500'
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-slate-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-slate-400" />
                    )}
                  </Button>
                </div>
                {registerForm.formState.errors.password && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {registerForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  确认密码
                </label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="请再次输入密码"
                    autoComplete="new-password"
                    disabled={isLoading}
                    {...registerForm.register('confirmPassword')}
                    className={cn(
                      'pr-10',
                      registerForm.formState.errors.confirmPassword && 'border-red-500 focus:border-red-500'
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-slate-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-slate-400" />
                    )}
                  </Button>
                </div>
                {registerForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {registerForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                注册
              </Button>
            </form>
          )}

          {/* Switch Mode */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {isLogin ? '还没有账户？' : '已有账户？'}
              <Button
                variant="link"
                className="p-0 ml-1 h-auto font-medium"
                onClick={switchMode}
                disabled={isLoading}
              >
                {isLogin ? '立即注册' : '立即登录'}
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}