'use client';
import Badge from '../ui/Badge';

function MenuItem({ item }) {
  const hasDiscount = item.discount && item.discount > 0;
  const finalPrice = hasDiscount 
    ? item.price - (item.price * item.discount / 100)
    : item.price;

  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {/* Imagen */}
        {item.image && (
          <div className="relative w-full sm:w-32 h-32 sm:h-auto flex-shrink-0">
            <img 
              src={item.image} 
              alt={item.name}
              className="w-full h-full object-cover"
            />
            {hasDiscount && (
              <div className="absolute top-2 left-2">
                <Badge variant="discount" size="sm" rounded>
                  -{item.discount}%
                </Badge>
              </div>
            )}
          </div>
        )}
        
        {/* Contenido */}
        <div className="flex-grow p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-grow">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">
                {item.name}
              </h3>
              
              {/* Tags/Badges */}
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {item.tags.map((tag, idx) => (
                    <Badge 
                      key={idx} 
                      variant={tag.variant || 'default'} 
                      size="sm"
                    >
                      {tag.label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            {/* Precio */}
            <div className="text-right flex-shrink-0">
              {hasDiscount ? (
                <div>
                  <p className="text-sm text-gray-500 line-through mb-0.5">
                    ${item.price.toFixed(2)}
                  </p>
                  <p className="font-bold text-red-600 text-xl">
                    ${finalPrice.toFixed(2)}
                  </p>
                </div>
              ) : (
                <p className="font-bold text-green-600 text-lg">
                  ${item.price.toFixed(2)}
                </p>
              )}
            </div>
          </div>
          
          {/* Descripción */}
          {item.description && (
            <p className="text-sm text-gray-600 mb-2 line-clamp-2 sm:line-clamp-none">
              {item.description}
            </p>
          )}
          
          {/* Descripción larga (solo visible en desktop) */}
          {item.longDescription && (
            <p className="hidden sm:block text-xs text-gray-500 mt-2 italic">
              {item.longDescription}
            </p>
          )}
          
          {/* Información adicional */}
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
            {item.calories && (
              <span className="flex items-center gap-1">
                🔥 {item.calories} cal
              </span>
            )}
            {item.prepTime && (
              <span className="flex items-center gap-1">
                ⏱️ {item.prepTime} min
              </span>
            )}
            {item.isVegetarian && (
              <span className="flex items-center gap-1">
                🥬 Vegetariano
              </span>
            )}
            {item.isSpicy && (
              <span className="flex items-center gap-1">
                🌶️ Picante
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MenuItem;
