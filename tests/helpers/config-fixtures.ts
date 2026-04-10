import type { TempHome } from './temp-home.js';

export async function seedDefaultProfile(tempHome: TempHome): Promise<void> {
  await tempHome.writeConfig({
    default: 'prod',
    profiles: {
      prod: {
        api_key: 'prod-api-key',
        auth_token: 'prod-auth-token',
        default_project_id: '46429',
        default_location: 'Delhi'
      }
    }
  });
}
