import React from 'react';
import { TechStack } from '../types';
import { CheckIcon } from './Icons';

interface TechSelectProps {
  selected: TechStack[];
  onToggle: (stack: TechStack) => void;
}

const ALL_STACKS = Object.values(TechStack);

export const TechSelect: React.FC<TechSelectProps> = ({ selected, onToggle }) => {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-slate-700">
        1. 选择技术栈
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {ALL_STACKS.map((stack) => {
          const isSelected = selected.includes(stack);
          return (
            <button
              key={stack}
              onClick={() => onToggle(stack)}
              className={`
                flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 border w-full
                ${isSelected 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200' 
                  : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-slate-50'
                }
              `}
            >
              <span className="truncate">{stack}</span>
              {isSelected && <CheckIcon className="w-3.5 h-3.5 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};