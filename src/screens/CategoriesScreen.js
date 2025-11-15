// src/screens/CategoriesScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  RefreshControl
} from 'react-native';
import { useNotes } from '../context/NotesContext';
import { useFocusEffect } from '@react-navigation/native';

const CategoriesScreen = ({ navigation }) => {
  const { 
    categories, 
    createCategory, 
    updateCategory, 
    deleteCategory, 
    getNotesByCategory,
    refreshData,
    loading
  } = useNotes();
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState('#6366f1');
  const [refreshing, setRefreshing] = useState(false);

  const colorOptions = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6b7280'
  ];

  // Refresh categories when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('🎯 CategoriesScreen focused - refreshing data');
      refreshData();
    }, [refreshData])
  );

  // Reset modal when it closes
  useEffect(() => {
    if (!modalVisible) {
      resetModal();
    }
  }, [modalVisible]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
      console.log('🔄 Categories refreshed');
    } catch (error) {
      console.error('❌ Error refreshing categories:', error);
      Alert.alert('Error', 'Failed to refresh categories');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }

    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: categoryName.trim(),
          color: categoryColor
        });
        console.log('✅ Category updated:', categoryName);
      } else {
        await createCategory({
          name: categoryName.trim(),
          color: categoryColor
        });
        console.log('✅ Category created:', categoryName);
      }
      setModalVisible(false);
    } catch (error) {
      console.error('❌ Error saving category:', error);
      Alert.alert('Error', `Failed to save category: ${error.message}`);
    }
  };

  const handleEdit = (category) => {
    console.log('✏️ Editing category:', category.name);
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryColor(category.color);
    setModalVisible(true);
  };

  const handleDelete = async (category) => {
    const categoryNotes = getNotesByCategory(category.id);
    const noteCount = categoryNotes.length;
    
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"?${
        noteCount > 0 ? ` ${noteCount} note${noteCount !== 1 ? 's' : ''} in this category will become uncategorized.` : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(category.id);
              console.log('🗑️ Category deleted:', category.name);
            } catch (error) {
              console.error('❌ Error deleting category:', error);
              Alert.alert('Error', `Failed to delete category: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const resetModal = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryColor('#6366f1');
  };

  const navigateToCategoryNotes = (category) => {
    console.log('📁 Navigating to category notes:', category.name);
    navigation.navigate('Notes', { 
      categoryId: category.id,
      filterTitle: category.name
    });
  };

  const getCategoryNoteCount = (categoryId) => {
    return getNotesByCategory(categoryId).length;
  };

  const CategoryCard = ({ category }) => {
    const noteCount = getCategoryNoteCount(category.id);
    
    return (
      <TouchableOpacity 
        style={styles.categoryCard}
        onPress={() => navigateToCategoryNotes(category)}
        onLongPress={() => handleEdit(category)}
        activeOpacity={0.7}
      >
        <View style={[styles.colorIndicator, { backgroundColor: category.color }]} />
        <View style={styles.categoryInfo}>
          <Text style={styles.categoryName}>{category.name}</Text>
          <Text style={styles.noteCount}>
            {noteCount} note{noteCount !== 1 ? 's' : ''}
          </Text>
          {noteCount === 0 && (
            <Text style={styles.emptyCategoryText}>No notes yet</Text>
          )}
        </View>
        <View style={styles.categoryActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleEdit(category)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.actionText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleDelete(category)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.actionText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const sortedCategories = [...categories].sort((a, b) => {
    // Sort by note count (descending) then by name
    const countA = getCategoryNoteCount(a.id);
    const countB = getCategoryNoteCount(b.id);
    if (countB !== countA) return countB - countA;
    return a.name.localeCompare(b.name);
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Categories</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.addButtonText}>+ New Category</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'} • {' '}
          {categories.reduce((total, cat) => total + getCategoryNoteCount(cat.id), 0)} total notes
        </Text>
      </View>

      <FlatList
        data={sortedCategories}
        renderItem={({ item }) => <CategoryCard category={item} />}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#6366f1']}
            tintColor="#6366f1"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📁</Text>
            <Text style={styles.emptyTitle}>No categories yet</Text>
            <Text style={styles.emptyText}>
              Create categories to organize your notes by topic, project, or subject
            </Text>
            <TouchableOpacity 
              style={styles.createFirstButton}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.createFirstButtonText}>Create First Category</Text>
            </TouchableOpacity>
          </View>
        }
        ListHeaderComponent={
          sortedCategories.length > 0 ? (
            <Text style={styles.listHeader}>
              Your Categories ({sortedCategories.length})
            </Text>
          ) : null
        }
      />

      {/* Category Editor Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingCategory ? 'Edit Category' : 'New Category'}
            </Text>
            
            <TextInput
              style={styles.textInput}
              placeholder="Category Name"
              placeholderTextColor="#999"
              value={categoryName}
              onChangeText={setCategoryName}
              autoFocus={!editingCategory}
              maxLength={50}
              returnKeyType="done"
              onSubmitEditing={handleSaveCategory}
            />
            
            <Text style={styles.colorLabel}>Choose Color:</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.colorOptionsContainer}
            >
              <View style={styles.colorOptions}>
                {colorOptions.map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      categoryColor === color && styles.colorOptionSelected
                    ]}
                    onPress={() => setCategoryColor(color)}
                    activeOpacity={0.7}
                  />
                ))}
              </View>
            </ScrollView>
            
            <View style={styles.selectedColorPreview}>
              <View style={[styles.colorPreview, { backgroundColor: categoryColor }]} />
              <Text style={styles.selectedColorText}>
                {editingCategory ? 'Updated color' : 'Selected color'}: {categoryColor}
              </Text>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.modalButton, 
                  styles.saveButton, 
                  !categoryName.trim() && styles.saveButtonDisabled
                ]}
                onPress={handleSaveCategory}
                disabled={!categoryName.trim()}
                activeOpacity={0.7}
              >
                <Text style={styles.saveButtonText}>
                  {editingCategory ? 'Update' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#6366f1',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  statsContainer: {
    backgroundColor: '#fff',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statsText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
  },
  listHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 15,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  colorIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  noteCount: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  emptyCategoryText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  categoryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  actionText: {
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.7,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  createFirstButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  createFirstButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 20,
    textAlign: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#f8fafc',
  },
  colorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 12,
  },
  colorOptionsContainer: {
    paddingVertical: 4,
  },
  colorOptions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#334155',
    transform: [{ scale: 1.1 }],
  },
  selectedColorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  colorPreview: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  selectedColorText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  saveButton: {
    backgroundColor: '#6366f1',
  },
  saveButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  cancelButtonText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default CategoriesScreen;