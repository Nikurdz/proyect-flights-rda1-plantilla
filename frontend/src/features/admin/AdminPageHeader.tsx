import React from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { adminPage, type AdminPageKey } from './admin-nav';

/** PageHeader of an admin page: the breadcrumbs «Administración › Grupo › Página» come from the nav structure. */
export const AdminPageHeader: React.FC<{ page: AdminPageKey; description?: React.ReactNode; actions?: React.ReactNode }> = ({ page, description, actions }) => {
  const { group, item } = adminPage(page);
  return (
    <PageHeader
      title={item.label}
      description={description}
      actions={actions}
      breadcrumbs={[{ label: 'Administración', to: '/admin/dashboard' }, { label: group.label }, { label: item.label }]}
    />
  );
};
