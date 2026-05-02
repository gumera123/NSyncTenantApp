import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AdminTable from '../components/AdminTable';

export default function WorkspacesPage({ workspaces }) {
  const columns = [
    { key: 'name', label: 'Workspace', width: 220 },
    {
      key: 'owner',
      label: 'Owner',
      width: 230,
      render: (workspace) => (
        <View>
          <Text style={styles.ownerName}>{workspace.ownerName}</Text>
          <Text style={styles.ownerEmail}>{workspace.ownerEmail}</Text>
        </View>
      ),
    },
    { key: 'members', label: 'Members', width: 120 },
    { key: 'boards', label: 'Boards', width: 120 },
    { key: 'tasks', label: 'Tasks', width: 120 },
  ];

  return (
    <View>
      <Text style={styles.title}>Workspaces</Text>
      <Text style={styles.subtitle}>Derived from each user workspace/organization profile in Firestore.</Text>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Workspace Directory</Text>
          <Text style={styles.panelMeta}>{workspaces.length} total</Text>
        </View>

        <AdminTable columns={columns} rows={workspaces} emptyText="No workspaces found." />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: '#071720',
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: '#64748b',
    marginTop: 5,
    marginBottom: 18,
  },
  panel: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 16,
  },
  panelHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  panelTitle: {
    color: '#071720',
    fontSize: 18,
    fontWeight: '900',
  },
  panelMeta: {
    color: '#64748b',
    fontWeight: '700',
  },
  ownerName: {
    color: '#0f172a',
    fontWeight: '800',
  },
  ownerEmail: {
    color: '#64748b',
    marginTop: 2,
    fontSize: 12,
  },
});
