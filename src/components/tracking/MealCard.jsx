import { Trash2, Camera } from "lucide-react";

export default function MealCard({ meal, onDelete }) {
  return (
    <div className="flex items-center gap-3 bg-secondary/50 rounded-xl p-3">
      <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
        {meal.image_url ? (
          <img src={meal.image_url} alt={meal.name} className="w-full h-full object-cover" />
        ) : (
          <Camera size={18} className="text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{meal.name}</p>
        <div className="flex gap-3 mt-0.5">
          <span className="text-xs text-primary font-barlow font-bold">{meal.calories} cal</span>
          <span className="text-xs text-blue-400 font-barlow">{meal.protein_g}p</span>
          <span className="text-xs text-orange-400 font-barlow">{meal.carbs_g}c</span>
          <span className="text-xs text-yellow-400 font-barlow">{meal.fats_g}f</span>
        </div>
      </div>
      {onDelete && (
        <button onClick={() => onDelete(meal.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}