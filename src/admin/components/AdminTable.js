import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function AdminTable({ columns, rows, emptyText }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.table}>
        <View style={styles.headerRow}>
          {columns.map((column) => (
            <Text key={column.key} style={[styles.headerCell, { width: column.width || 160 }]}>
              {column.label}
            </Text>
          ))}
        </View>

        {rows.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>{emptyText || 'No records found.'}</Text>
          </View>
        ) : (
          rows.map((row) => (
            <View key={row.id} style={styles.row}>
              {columns.map((column) => (
                <View key={column.key} style={[styles.cell, { width: column.width || 160 }]}>
                  {column.render ? column.render(row) : <Text style={styles.cellText}>{row[column.key] || '-'}</Text>}
                </View>
              ))}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  table: {
    minWidth: 720,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerCell: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    color: '#475569',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
  },
  cell: {
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  cellText: {
    color: '#0f172a',
  },
  emptyRow: {
    padding: 18,
  },
  emptyText: {
    color: '#64748b',
  },
});
