const fs = require('fs');

// 1. Fix menu_screen.dart header overflow
const menuFile = 'D:\\My Web Sites\\KamaiPlus Android\\lib\\views\\menu\\menu_screen.dart';
let menuContent = fs.readFileSync(menuFile, 'utf8');

const oldHeaderRight = `                  const Spacer(),
                  GestureDetector(
                    onTap: () async {
                      await Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const StoreProfileScreen()),
                      );
                      _loadMenuData();
                    },
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              _profile.storeName,
                              style: GoogleFonts.outfit(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF0F172A),
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                            Text(
                              '\${_profile.ownerName} • \${_profile.category.split('/').first.trim()}',
                              style: GoogleFonts.inter(
                                fontSize: 11,
                                color: const Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(width: 8),
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: const Color(0xFF0B1528),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFF1E293B)),
                          ),
                          child: const Icon(
                            Icons.storefront_rounded,
                            size: 20,
                            color: Color(0xFFF59E0B),
                          ),
                        ),
                      ],
                    ),
                  ),`;

const newHeaderRight = `                  const SizedBox(width: 8),
                  Expanded(
                    child: GestureDetector(
                      onTap: () async {
                        await Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const StoreProfileScreen()),
                        );
                        _loadMenuData();
                      },
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Flexible(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  _profile.storeName,
                                  style: GoogleFonts.outfit(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: const Color(0xFF0F172A),
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                  maxLines: 1,
                                ),
                                Text(
                                  '\${_profile.ownerName} • \${_profile.category.split('/').first.trim()}',
                                  style: GoogleFonts.inter(
                                    fontSize: 11,
                                    color: const Color(0xFF64748B),
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                  maxLines: 1,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: const Color(0xFF0B1528),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFF1E293B)),
                            ),
                            child: const Icon(
                              Icons.storefront_rounded,
                              size: 20,
                              color: Color(0xFFF59E0B),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),`;

if (menuContent.includes(oldHeaderRight)) {
  menuContent = menuContent.replace(oldHeaderRight, newHeaderRight);
  fs.writeFileSync(menuFile, menuContent, 'utf8');
  console.log('Fixed menu_screen.dart header');
} else {
  console.log('oldHeaderRight not matched directly in menu_screen.dart');
}

// 2. Fix home_dashboard_screen.dart: initial tab = 2, and Center Billing Button gesture hit test
const homeFile = 'D:\\My Web Sites\\KamaiPlus Android\\lib\\views\\dashboard\\home_dashboard_screen.dart';
let homeContent = fs.readFileSync(homeFile, 'utf8');

homeContent = homeContent.replace('int _currentIndex = 0;', 'int _currentIndex = 2;');

const oldBillingBtn = `    return GestureDetector(
      onTap: () => _setTab(2),
      child: Column(`;

const newBillingBtn = `    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _setTab(2),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Column(`;

homeContent = homeContent.replace(oldBillingBtn, newBillingBtn);
// close the Padding
homeContent = homeContent.replace(
`          Container(
            width: 4,
            height: 4,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isSelected ? const Color(0xFF059669) : Colors.transparent,
            ),
          ),
        ],
      ),
    );`,
`          Container(
            width: 4,
            height: 4,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isSelected ? const Color(0xFF059669) : Colors.transparent,
            ),
          ),
        ],
      ),
      ),
    );`
);

fs.writeFileSync(homeFile, homeContent, 'utf8');
console.log('Updated home_dashboard_screen.dart: default index = 2');
