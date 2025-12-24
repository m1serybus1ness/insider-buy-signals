// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Insider Buy Signals
 * 
 * Marketplace for buying and selling encrypted crypto trading signals.
 * Sellers create listings with encrypted signals, buyers purchase them.
 * Signals are encrypted with FHE before being stored on-chain.
 * Buyers can rate sellers.
 */
contract InsiderBuySignals {
    
    struct Listing {
        address seller;
        string description;
        uint256 price;
        bytes32 encryptedSignal;
        uint256 createdAt;
        bool isActive;
        uint256 purchaseCount;
    }
    
    struct Purchase {
        address buyer;
        uint256 listingId;
        bytes32 encryptedSignal;
        uint256 purchasedAt;
    }
    
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Purchase[]) public listingPurchases;
    mapping(address => uint256[]) public sellerListings;
    mapping(address => uint256[]) public buyerPurchases;
    mapping(uint256 => mapping(address => bool)) public hasPurchased;
    
    struct SellerRating {
        int256 totalRating;
        uint256 voteCount;
        mapping(address => bool) hasRated;
    }
    
    mapping(address => SellerRating) public sellerRatings;
    
    uint256 public listingCounter;
    
    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        string description,
        uint256 price
    );
    
    event SignalPurchased(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 price
    );
    
    event ListingDeactivated(
        uint256 indexed listingId,
        address indexed seller
    );
    
    event SellerRated(
        address indexed seller,
        address indexed rater,
        int256 rating
    );
    
    function createListing(
        string memory _description,
        uint256 _price,
        bytes32 _encryptedSignal
    ) external returns (uint256) {
        require(bytes(_description).length > 0, "Description cannot be empty");
        require(_price > 0, "Price must be greater than 0");
        require(_encryptedSignal != bytes32(0), "Encrypted signal cannot be empty");
        
        uint256 listingId = listingCounter;
        listingCounter++;
        
        listings[listingId] = Listing({
            seller: msg.sender,
            description: _description,
            price: _price,
            encryptedSignal: _encryptedSignal,
            createdAt: block.timestamp,
            isActive: true,
            purchaseCount: 0
        });
        
        sellerListings[msg.sender].push(listingId);
        
        emit ListingCreated(listingId, msg.sender, _description, _price);
        return listingId;
    }
    
    function purchaseSignal(uint256 _listingId) external payable {
        Listing storage listing = listings[_listingId];
        require(listing.seller != address(0), "Listing does not exist");
        require(listing.isActive, "Listing is not active");
        require(msg.value >= listing.price, "Insufficient payment");
        require(msg.sender != listing.seller, "Cannot purchase own listing");
        
        bool alreadyPurchased = hasPurchased[_listingId][msg.sender];
        
        listingPurchases[_listingId].push(Purchase({
            buyer: msg.sender,
            listingId: _listingId,
            encryptedSignal: listing.encryptedSignal,
            purchasedAt: block.timestamp
        }));
        
        if (!alreadyPurchased) {
            buyerPurchases[msg.sender].push(_listingId);
            hasPurchased[_listingId][msg.sender] = true;
            listing.purchaseCount++;
        }
        
        payable(listing.seller).transfer(listing.price);
        
        if (msg.value > listing.price) {
            payable(msg.sender).transfer(msg.value - listing.price);
        }
        
        emit SignalPurchased(_listingId, msg.sender, listing.seller, listing.price);
    }
    
    function deactivateListing(uint256 _listingId) external {
        Listing storage listing = listings[_listingId];
        require(listing.seller == msg.sender, "Only seller can deactivate listing");
        require(listing.isActive, "Listing is already inactive");
        
        listing.isActive = false;
        emit ListingDeactivated(_listingId, msg.sender);
    }
    
    function getListing(uint256 _listingId) external view returns (
        address seller,
        string memory description,
        uint256 price,
        uint256 createdAt,
        bool isActive,
        uint256 purchaseCount
    ) {
        Listing storage listing = listings[_listingId];
        require(listing.seller != address(0), "Listing does not exist");
        
        return (
            listing.seller,
            listing.description,
            listing.price,
            listing.createdAt,
            listing.isActive,
            listing.purchaseCount
        );
    }
    
    function getListingEncryptedSignal(uint256 _listingId) external view returns (bytes32) {
        Listing storage listing = listings[_listingId];
        require(listing.seller != address(0), "Listing does not exist");
        require(
            msg.sender == listing.seller || hasPurchased[_listingId][msg.sender],
            "Must be seller or buyer to access signal"
        );
        
        return listing.encryptedSignal;
    }
    
    function getPurchase(uint256 _listingId, uint256 _purchaseIndex) external view returns (
        address buyer,
        bytes32 encryptedSignal,
        uint256 purchasedAt
    ) {
        require(_purchaseIndex < listingPurchases[_listingId].length, "Purchase does not exist");
        Purchase storage purchase = listingPurchases[_listingId][_purchaseIndex];
        
        require(
            msg.sender == purchase.buyer || msg.sender == listings[_listingId].seller,
            "Not authorized to view purchase"
        );
        
        return (
            purchase.buyer,
            purchase.encryptedSignal,
            purchase.purchasedAt
        );
    }
    
    function getSellerListings(address _seller) external view returns (uint256[] memory) {
        return sellerListings[_seller];
    }
    
    function getBuyerPurchases(address _buyer) external view returns (uint256[] memory) {
        return buyerPurchases[_buyer];
    }
    
    function getActiveListings(uint256 _limit) external view returns (uint256[] memory) {
        uint256[] memory activeListings = new uint256[](_limit);
        uint256 count = 0;
        
        for (uint256 i = listingCounter; i > 0 && count < _limit; i--) {
            uint256 listingId = i - 1;
            Listing storage listing = listings[listingId];
            
            if (listing.seller != address(0) && listing.isActive) {
                activeListings[count] = listingId;
                count++;
            }
        }
        
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeListings[i];
        }
        
        return result;
    }
    
    function hasUserPurchased(uint256 _listingId, address _user) external view returns (bool) {
        return hasPurchased[_listingId][_user];
    }
    
    function rateSeller(address _seller, int256 _rating) external {
        require(_seller != address(0), "Invalid seller address");
        require(_seller != msg.sender, "Cannot rate yourself");
        require(_rating == 1 || _rating == -1, "Rating must be 1 or -1");
        
        SellerRating storage rating = sellerRatings[_seller];
        require(!rating.hasRated[msg.sender], "Already rated this seller");
        
        rating.hasRated[msg.sender] = true;
        rating.totalRating += _rating;
        rating.voteCount++;
        
        emit SellerRated(_seller, msg.sender, _rating);
    }
    
    function getSellerRating(address _seller) external view returns (int256 totalRating, uint256 voteCount) {
        SellerRating storage rating = sellerRatings[_seller];
        return (rating.totalRating, rating.voteCount);
    }
    
    function hasRatedSeller(address _seller, address _rater) external view returns (bool) {
        return sellerRatings[_seller].hasRated[_rater];
    }
}

