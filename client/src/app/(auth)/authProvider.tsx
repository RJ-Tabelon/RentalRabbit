'use client';

import React, { useEffect } from 'react';
import { Amplify } from 'aws-amplify';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { useRouter, usePathname } from 'next/navigation';

// https://docs.amplify.aws/gen1/javascript/tools/libraries/configure-categories/

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_AWS_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.NEXT_PUBLIC_AWS_COGNITO_USER_POOL_CLIENT_ID!,
    }
  }
});

const Auth = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthenticator(context => [context.user]);
  const router = useRouter();
  const pathname = usePathname();

  const isAuthPage = pathname.match(/^\/(signin|signup)$/);
  const isDashboardPage = pathname.startsWith("/manager") || pathname.startsWith("/tenants");

  useEffect(() => {
    if (user && isAuthPage) {
      router.push('/');
    }
  }, [user, isAuthPage, router]);

  if (!isAuthPage && !isDashboardPage) {
    return <>{children}</>;
  }

  return (
    <div className='h-full'>
      <Authenticator
        initialState={pathname.includes('signup') ? 'signUp' : 'signIn'}
      >
        {() => <>{children}</>}
      </Authenticator>
    </div>
  );
};

export default Auth;
