import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { 
  User, 
  Bell, 
  Shield, 
  Palette, 
  Database,
  Download,
  Trash2,
  Save
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/stores/useAuthStore'
import { useToast } from '@/hooks/useToast'

const profileSchema = z.object({
  username: z.string().min(3, '用户名至少3个字符').max(50, '用户名最多50个字符'),
  email: z.string().email('请输入有效的邮箱地址'),
  displayName: z.string().max(100, '显示名称最多100个字符').optional(),
  bio: z.string().max(500, '个人简介最多500个字符').optional(),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string().min(6, '新密码至少6个字符').max(100, '新密码最多100个字符'),
  confirmPassword: z.string(),
}).refine((data: any) => data.newPassword === data.confirmPassword, {
  message: '两次输入的新密码不一致',
  path: ['confirmPassword'],
})

type ProfileForm = z.infer<typeof profileSchema>
type PasswordForm = z.infer<typeof passwordSchema>

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile')
  const { user } = useAuthStore()
  const { toast } = useToast()

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: user?.username || '',
      email: user?.email || '',
      displayName: user?.displayName || '',
      bio: user?.bio || '',
    },
  })

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const onProfileSubmit = async (data: ProfileForm) => {
    try {
      // TODO: Call API to update profile
      console.log('Updating profile:', data)
      
      toast({
        title: '个人资料已更新',
        description: '您的个人资料信息已成功保存',
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: '更新失败',
        description: '更新个人资料时出现错误，请稍后重试',
        variant: 'destructive',
      })
    }
  }

  const onPasswordSubmit = async (_data: PasswordForm) => {
    try {
      // TODO: Call API to change password
      console.log('Changing password')
      
      passwordForm.reset()
      toast({
        title: '密码已更新',
        description: '您的密码已成功修改',
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: '密码修改失败',
        description: '修改密码时出现错误，请检查当前密码是否正确',
        variant: 'destructive',
      })
    }
  }

  const handleExportData = () => {
    toast({
      title: '导出数据',
      description: '数据导出功能将在后续版本中提供',
    })
  }

  const handleDeleteAccount = () => {
    if (confirm('确定要删除账户吗？此操作无法撤销，所有数据将被永久删除。')) {
      toast({
        title: '删除账户',
        description: '账户删除功能将在后续版本中提供',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="container max-w-4xl mx-auto py-6">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">设置</h1>
          <p className="text-muted-foreground">
            管理您的账户设置和应用偏好
          </p>
        </div>

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              个人资料
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              外观
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              通知
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              隐私
            </TabsTrigger>
            <TabsTrigger value="data" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              数据
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>个人信息</CardTitle>
                <CardDescription>
                  更新您的个人信息和账户详情
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">用户名</label>
                      <Input
                        {...profileForm.register('username')}
                        placeholder="请输入用户名"
                      />
                      {profileForm.formState.errors.username && (
                        <p className="text-sm text-destructive">
                          {profileForm.formState.errors.username.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">邮箱地址</label>
                      <Input
                        {...profileForm.register('email')}
                        type="email"
                        placeholder="请输入邮箱地址"
                      />
                      {profileForm.formState.errors.email && (
                        <p className="text-sm text-destructive">
                          {profileForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">显示名称</label>
                    <Input
                      {...profileForm.register('displayName')}
                      placeholder="请输入显示名称（可选）"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">个人简介</label>
                    <Textarea
                      {...profileForm.register('bio')}
                      placeholder="简单介绍一下自己（可选）"
                      rows={3}
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    <Save className="mr-2 h-4 w-4" />
                    保存个人信息
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>修改密码</CardTitle>
                <CardDescription>
                  为了账户安全，请定期更新您的密码
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">当前密码</label>
                    <Input
                      {...passwordForm.register('currentPassword')}
                      type="password"
                      placeholder="请输入当前密码"
                    />
                    {passwordForm.formState.errors.currentPassword && (
                      <p className="text-sm text-destructive">
                        {passwordForm.formState.errors.currentPassword.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">新密码</label>
                    <Input
                      {...passwordForm.register('newPassword')}
                      type="password"
                      placeholder="请输入新密码"
                    />
                    {passwordForm.formState.errors.newPassword && (
                      <p className="text-sm text-destructive">
                        {passwordForm.formState.errors.newPassword.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">确认新密码</label>
                    <Input
                      {...passwordForm.register('confirmPassword')}
                      type="password"
                      placeholder="请再次输入新密码"
                    />
                    {passwordForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-destructive">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <Button type="submit" className="w-full">
                    <Shield className="mr-2 h-4 w-4" />
                    更新密码
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>主题设置</CardTitle>
                <CardDescription>
                  自定义应用的外观和主题
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">深色模式</p>
                      <p className="text-sm text-muted-foreground">
                        切换应用的明暗主题
                      </p>
                    </div>
                    {/* TODO: Add theme toggle switch */}
                    <Button variant="outline" size="sm">
                      切换主题
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>通知设置</CardTitle>
                <CardDescription>
                  管理您接收通知的方式和类型
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    通知功能将在后续版本中提供
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>隐私设置</CardTitle>
                <CardDescription>
                  控制您的数据隐私和安全设置
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    隐私设置功能将在后续版本中提供
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Tab */}
          <TabsContent value="data" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>数据管理</CardTitle>
                <CardDescription>
                  导出、备份或删除您的数据
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Download className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">导出数据</p>
                        <p className="text-sm text-muted-foreground">
                          下载您的所有对话和设置数据
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={handleExportData}>
                      导出
                    </Button>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between p-4 border rounded-lg border-destructive/20">
                    <div className="flex items-center gap-3">
                      <Trash2 className="h-5 w-5 text-destructive" />
                      <div>
                        <p className="font-medium text-destructive">删除账户</p>
                        <p className="text-sm text-muted-foreground">
                          永久删除您的账户和所有相关数据
                        </p>
                      </div>
                    </div>
                    <Button variant="destructive" onClick={handleDeleteAccount}>
                      删除账户
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}