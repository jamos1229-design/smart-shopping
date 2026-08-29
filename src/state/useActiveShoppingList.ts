import { useEffect, useMemo, useState } from 'react';
import { useAppData } from './AppDataContext';
import { generateId, todayISODate } from '../lib/id';

export function useActiveShoppingList() {
  const { shoppingLists, saveShoppingList, shoppingListItems } = useAppData();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  const today = todayISODate();

  useEffect(() => {
    if (selectedListId && shoppingLists.some((l) => l.shoppingListId === selectedListId)) return;
    const todaysList = shoppingLists.find((l) => l.date === today);
    if (todaysList) {
      setSelectedListId(todaysList.shoppingListId);
    } else if (shoppingLists.length === 0) {
      const newList = {
        shoppingListId: generateId(),
        name: '今日の買い物',
        date: today,
        memo: '',
        createdAt: new Date().toISOString(),
      };
      saveShoppingList(newList);
      setSelectedListId(newList.shoppingListId);
    } else {
      setSelectedListId(shoppingLists[0].shoppingListId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shoppingLists, selectedListId, today]);

  const list = useMemo(
    () => shoppingLists.find((l) => l.shoppingListId === selectedListId) ?? null,
    [shoppingLists, selectedListId],
  );

  const items = useMemo(
    () => shoppingListItems.filter((item) => item.shoppingListId === selectedListId),
    [shoppingListItems, selectedListId],
  );

  return { list, items, selectedListId, setSelectedListId };
}
